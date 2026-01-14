(function () {

  const margin = { top: 40, right: 160, bottom: 80, left: 80 };
  const width = 1100 - margin.left - margin.right;
  const height = 520 - margin.top - margin.bottom;

  function parseNum(s) {
    if (s === undefined || s === null) return NaN;
    let v = String(s).trim();
    if (v === "" || v.toLowerCase() === "nan") return NaN;
    v = v.replace(/\s/g, "").replace(/,/g, ".");
    v = v.replace(/[^0-9eE+.\-]/g, "");
    const n = parseFloat(v);
    return isFinite(n) ? n : NaN;
  }

  function renderWaterChart(containerId) {

    const container = d3.select(containerId);
    container.selectAll("*").remove();

    const layout = container
      .append("div")
      .attr("class", "waterfall-layout");

    const controls = layout
      .append("div")
      .attr("class", "waterfall-controls");

    controls.append("label")
      .text("Country");

    const select = controls.append("select")
      .attr("size", 8);

    const resetBtn = controls.append("button")
      .text("Reset View");

    const card = layout
      .append("div")
      .attr("class", "waterfall-card");

    const svg = card.append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const chartG = g.append("g");
    const xAxisG = g.append("g").attr("transform", `translate(0,${height})`);
    const yAxisG = g.append("g");
    const legendG = g.append("g").attr("transform", `translate(${width + 20},10)`);

    const tooltip = container.append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("pointer-events", "none");

    d3.text("data/merged.csv").then(raw => {

      const dsv = d3.dsvFormat(";");
      const rows = dsv.parse(raw);

      const keys = Object.keys(rows[0] || {});
      const countryKey = keys.find(k => /country/i.test(k)) || keys[1];
      const yearKey = keys.find(k => /year/i.test(k)) || "Year";
      const gdpKey = keys.find(k => /GDP/i.test(k)) || "GDP";

      const cleaned = rows.map(r => ({
        country: r[countryKey]?.trim(),
        year: +r[yearKey],
        gdp: parseNum(r[gdpKey])
      })).filter(d => d.country && !isNaN(d.year));

      const byCountry = d3.group(cleaned, d => d.country);
      const countries = Array.from(byCountry.keys()).sort(d3.ascending);

      select.selectAll("option")
        .data(countries)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      const xBand = d3.scaleBand().paddingInner(0.15).range([0, width]);
      const y = d3.scaleLinear().range([height, 0]);

      const fmt = d3.format(",.0f");
      const fmtShort = d3.format(".2s");

      function computeWaterfall(dataSorted) {
        const items = [];
        let cum = dataSorted[0].gdp || 0;

        items.push({
          type: "start",
          year: dataSorted[0].year,
          value: dataSorted[0].gdp,
          start: 0,
          end: cum
        });

        for (let i = 1; i < dataSorted.length; i++) {
          const prev = dataSorted[i - 1].gdp || 0;
          const cur = dataSorted[i].gdp || 0;
          items.push({
            type: cur - prev >= 0 ? "increase" : "decrease",
            year: dataSorted[i].year,
            value: cur - prev,
            start: prev,
            end: cur
          });
        }
        return items;
      }

      function draw(country) {

        chartG.selectAll("*").remove();
        legendG.selectAll("*").remove();

        const rows = (byCountry.get(country) || []).sort((a, b) => a.year - b.year);
        if (!rows.length) return;

        const items = computeWaterfall(rows);
        const years = items.map(d => d.year);

        xBand.domain(years);

        const values = items.flatMap(d => [d.start, d.end]);
        y.domain([
          d3.min(values.concat(0)) * 1.05,
          d3.max(values.concat(0)) * 1.05
        ]).nice();

        const xTicksEvery = Math.ceil(years.length / 12);
        const xTickValues = years.filter((_, i) => i % xTicksEvery === 0);

        xAxisG.call(
          d3.axisBottom(xBand)
            .tickValues(xTickValues)
            .tickFormat(d3.format("d"))
        ).selectAll("text")
          .attr("transform", "rotate(-40)")
          .style("text-anchor", "end");

        yAxisG.call(d3.axisLeft(y).tickFormat(fmtShort));

        chartG.append("text")
          .attr("class", "chart-title")
          .attr("x", 0)
          .attr("y", -18)
          .text(`${country} — GDP Waterfall`);

        const bw = Math.max(6, xBand.bandwidth());

        const bar = chartG.selectAll(".bar")
          .data(items)
          .join("g")
          .attr("class", "bar")
          .attr("transform", d => `translate(${xBand(d.year)},0)`);

        bar.append("rect")
          .attr("x", 0)
          .attr("width", bw)
          .attr("y", d => y(Math.max(d.start, d.end)))
          .attr("height", d => Math.max(1, Math.abs(y(d.start) - y(d.end))))
          .attr("fill", d => d.type === "start" ? "#4682b4" : d.type === "increase" ? "#2e8b57" : "#b22222")
          .attr("stroke", "#333")
          .on("mouseenter", (event, d) => {
            tooltip
              .style("opacity", 1)
              .html(
                d.type === "start"
                  ? `<strong>${d.year}</strong><br>Start: ${fmt(d.value)}`
                  : `<strong>${d.year}</strong><br>Δ: ${(d.value >= 0 ? "+" : "") + fmt(d.value)}<br>Prev: ${fmt(d.start)}<br>Now: ${fmt(d.end)}`
              )
              .style("left", (event.pageX + 14) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseleave", () => {
            tooltip.style("opacity", 0);
          });

        bar.append("text")
          .attr("x", bw / 2)
          .attr("y", d => y(Math.max(d.start, d.end)) - 6)
          .attr("text-anchor", "middle")
          .style("font-size", "12px")
          .text(d => d.type === "start" ? fmt(d.value) : (d.value >= 0 ? "+" : "") + fmt(d.value));

        const legendData = [
          { label: "Start", color: "#4682b4" },
          { label: "Increase", color: "#2e8b57" },
          { label: "Decrease", color: "#b22222" }
        ];

        const legend = legendG.selectAll(".legendItem")
          .data(legendData)
          .join("g")
          .attr("class", "legendItem")
          .attr("transform", (d, i) => `translate(0,${i * 22})`);

        legend.append("rect")
          .attr("width", 14)
          .attr("height", 14)
          .attr("fill", d => d.color)
          .attr("stroke", "#333");

        legend.append("text")
          .attr("x", 20)
          .attr("y", 12)
          .text(d => d.label);
      }

      draw(countries[0]);

      select.on("change", e => draw(e.target.value));
      resetBtn.on("click", () => draw(select.node().value));

    }).catch(err => {
      console.error(err);
      card.append("div").text("Error loading data.");
    });
  }

  window.renderWaterChart = renderWaterChart;

})();

