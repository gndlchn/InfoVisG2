(function () {
  const margin = { top: 80, right: 30, bottom: 80, left: 60 };
  const totalWidth = 800;
  const totalHeight = 400;
  const width = totalWidth - margin.left - margin.right;
  const height = totalHeight - margin.top - margin.bottom;

  function parseNum(s) {
    if (s === undefined || s === null) return NaN;
    let v = String(s).trim().replace(/\s/g, "").replace(/,/g, ".");
    const n = parseFloat(v.replace(/[^0-9eE+.\-]/g, ""));
    return isFinite(n) ? n : NaN;
  }

  function renderWaterChart(containerId, state, displayName) {
    const container = d3.select(containerId);
    const tooltip = d3.select("#chart-tooltip");
    container.selectAll("*").remove();

    const svgRoot = container.append("svg")
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const title = svgRoot.append("text")
      .attr("x", totalWidth / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("font-family", "sans-serif");

    const g = svgRoot.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const defs = svgRoot.append("defs");
    defs.append("clipPath").attr("id", "water-chart-clip")
      .append("rect").attr("width", width).attr("height", height);
    defs.append("clipPath").attr("id", "water-x-axis-clip")
        .append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", margin.bottom);

    const chartArea = g.append("g").attr("clip-path", "url(#water-chart-clip)");
    const yAxisG = g.append("g");
    const xAxisG = g.append("g")
      .attr("transform", `translate(0,${height})`)
      .attr("clip-path", "url(#water-x-axis-clip)");
    
    const chartCenterX = (totalWidth / 2) - margin.left;

    g.append("text")
      .attr("x", chartCenterX)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Year");

    const yLabel = g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .style("font-size", "12px");

    const colors = { start: "#555555", increase: "#0072B2", decrease: "#D55E00" };
    const legendData = [
      { l: "Start", c: colors.start, x: -100 },
      { l: "Increase", c: colors.increase, x: 0 },
      { l: "Decrease", c: colors.decrease, x: 100 }
    ];
    
    const legend = g.append("g")
      .attr("class", "legend-group")
      .attr("transform", `translate(${chartCenterX}, ${height + 60})`);

    const legendItems = legend.selectAll("g")
      .data(legendData)
      .join("g")
      .attr("transform", d => `translate(${d.x}, 0)`);

    legendItems.append("rect")
      .attr("x", -50) 
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", d => d.c);

    legendItems.append("text")
      .attr("x", -32)
      .attr("y", 10)
      .style("font-size", "12px")
      .text(d => d.l);

    d3.text("data/merged.csv").then(raw => {
      const rows = d3.dsvFormat(";").parse(raw);
      const indicatorKey = state.indicator;
      const cleaned = rows.map(r => ({
        country: r["Country Name"]?.trim(),
        year: +r["Year"],
        val: parseNum(r[indicatorKey])
      })).filter(d => d.country && !isNaN(d.year));

      const byCountry = d3.group(cleaned, d => d.country);
      const countries = Array.from(byCountry.keys()).sort();
      const xBand = d3.scaleBand().paddingInner(0.2).range([0, width]);
      const y = d3.scaleLinear().range([height, 0]);

      function computeWaterfall(dataSorted) {
        const items = [];
        if (dataSorted.length === 0) return items;
        let cum = dataSorted[0].val || 0;
        items.push({ type: "start", year: dataSorted[0].year, value: dataSorted[0].val, start: 0, end: cum });
        for (let i = 1; i < dataSorted.length; i++) {
          const prev = dataSorted[i - 1].val || 0;
          const cur = dataSorted[i].val || 0;
          items.push({ type: cur - prev >= 0 ? "increase" : "decrease", year: dataSorted[i].year, value: cur - prev, start: prev, end: cur });
        }
        return items;
      }

      function draw(country) {
        title.text(`Evolution of ${displayName} in ${country}`);
        yLabel.text(displayName);

        chartArea.selectAll("*").remove();
        const rows = (byCountry.get(country) || []).sort((a, b) => a.year - b.year);
        if (!rows.length) return;

        const items = computeWaterfall(rows);
        xBand.domain(items.map(d => d.year));
        const minVal = d3.min(items, d => Math.min(d.start, d.end, 0));
        const maxVal = d3.max(items, d => Math.max(d.start, d.end, 0));
        y.domain([minVal * 1.1, maxVal * 1.1]).nice();

        const zoom = d3.zoom()
          .scaleExtent([1, 20])
          .extent([[0, 0], [width, height]])
          .translateExtent([[0, 0], [width, height]])
          .on("zoom", (event) => {
            const t = event.transform;
            const zy = t.rescaleY(y);
            const zx = xBand.copy().range([0, width].map(d => t.applyX(d)));

            yAxisG.call(d3.axisLeft(zy).tickFormat(d3.format(".2s")));
            xAxisG.call(d3.axisBottom(zx).tickValues(zx.domain().filter((_, i) => i % 2 === 0)));

            chartArea.selectAll(".bar")
              .attr("x", d => zx(d.year))
              .attr("y", d => zy(Math.max(d.start, d.end)))
              .attr("width", zx.bandwidth())
              .attr("height", d => Math.abs(zy(d.start) - zy(d.end)));

            chartArea.select(".zero-line").attr("y1", zy(0)).attr("y2", zy(0));
          });

        svgRoot.call(zoom);

        xAxisG.call(d3.axisBottom(xBand).tickValues(xBand.domain().filter((_, i) => i % 2 === 0)));
        yAxisG.call(d3.axisLeft(y).tickFormat(d3.format(".2s")));

        if (minVal < 0 && maxVal > 0) {
            chartArea.append("line").attr("class", "zero-line")
                .attr("x1", 0).attr("x2", width).attr("y1", y(0)).attr("y2", y(0))
                .attr("stroke", "black").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").style("opacity", 0.5);
        }

        chartArea.selectAll(".bar").data(items).join("rect")
          .attr("class", "bar")
          .attr("x", d => xBand(d.year))
          .attr("y", d => y(Math.max(d.start, d.end)))
          .attr("width", xBand.bandwidth())
          .attr("height", d => Math.abs(y(d.start) - y(d.end)))
          .attr("fill", d => colors[d.type])
          .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1)
                   .html(`<strong>${d.year}</strong><br>Change: ${d3.format(".2s")(d.value)}<br>Total: ${d3.format(".2s")(d.end)}`);
          })
          .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            tooltip.style("opacity", 0);
          });
      }
      
      draw(state.country || countries[0]);
    });
  }
  window.renderWaterChart = renderWaterChart;
})();