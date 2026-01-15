(function () {
  const margin = { top: 80, right: 30, bottom: 60, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const parseNum = v => {
    if (v === null || v === undefined || v === "") return NaN;
    if (typeof v === "number") return v;
    return parseFloat(String(v).replace(",", "."));
  };

  function renderBubbleChart(containerId, state) {
    const root = d3.select(containerId);
    const tooltip = d3.select("#chart-tooltip");
    root.selectAll("*").remove();

    const container = root.append("div")
      .attr("class", "bubble-container");

    const svgRoot = container.append("svg")
      .attr(
        "viewBox",
        `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
      )
      .attr("preserveAspectRatio", "xMidYMid meet");

    svgRoot.append("text")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .style("font-size", "20px")
      .style("font-weight", "bold")
      .style("font-family", "sans-serif")
      .text(`Trade openness of ${state.continent} in ${state.year}`);

    const svg = svgRoot.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("defs")
      .append("clipPath")
      .attr("id", "bubble-clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    const chartArea = svg.append("g")
      .attr("clip-path", "url(#bubble-clip)");

    d3.text("data/merged.csv").then(raw => {
      const data = d3.dsvFormat(";").parse(raw, d => ({
        country: d["Country Name"],
        region: d.continent,
        year: +d.Year,
        fdi: parseNum(d["Foreign direct investment. net inflows (% of GDP)"]),
        trade: parseNum(d["Trade (% of GDP)"]),
        gdp: parseNum(d["GDP ppp"])
      })).filter(d =>
        !isNaN(d.fdi) &&
        !isNaN(d.trade) &&
        !isNaN(d.gdp) &&
        d.region
      );

      const bubbleColor = "#0072B2";

      const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.fdi))
        .nice()
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.trade))
        .nice()
        .range([height, 0]);

      const rScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => d.gdp))
        .range([4, 40]);

      const xAxisG = svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));

      const yAxisG = svg.append("g")
        .call(d3.axisLeft(yScale));

      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("FDI Net Inflows (% of GDP)");

      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Trade (% of GDP)");

      const zoom = d3.zoom()
        .scaleExtent([1, 20])
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", event => {
          const zx = event.transform.rescaleX(xScale);
          const zy = event.transform.rescaleY(yScale);

          xAxisG.call(d3.axisBottom(zx));
          yAxisG.call(d3.axisLeft(zy));

          chartArea.selectAll("circle")
            .attr("cx", d => zx(d.fdi))
            .attr("cy", d => zy(d.trade));
        });

      svgRoot.call(zoom);

      const formatGDP = d =>
        d3.format(".3s")(d).replace("G", "B");

      function update() {
        const year = state.year;
        const region = state.continent;

        const filtered = data.filter(d =>
          d.year === year &&
          (region === "All Regions" || d.region === region)
        );

        const t = d3.zoomTransform(svgRoot.node());
        const zx = t.rescaleX(xScale);
        const zy = t.rescaleY(yScale);

        chartArea.selectAll("circle")
          .data(filtered, d => d.country)
          .join(
            enter => enter.append("circle")
              .attr("cx", d => zx(d.fdi))
              .attr("cy", d => zy(d.trade))
              .attr("r", d => rScale(d.gdp))
              .attr("fill", bubbleColor)
              .attr("opacity", 0.5)
              .style("cursor", "pointer") // Visual cue for interactivity
              .on("mouseover", function(event, d) {
                tooltip.style("opacity", 1)
                       .html(`<strong>${d.country}</strong><br>FDI: ${d.fdi.toFixed(2)}%<br>Trade: ${d.trade.toFixed(2)}%<br>GDP PPP: ${formatGDP(d.gdp)}`);
              })
              .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 10) + "px");
              })
              .on("mouseout", function() {
                tooltip.style("opacity", 0);
              })
              .on("click", function(event, d) {
                // Update filters using the dashboard's helper function
                if (typeof window.updateFilters === "function") {
                  window.updateFilters(d.country, d.region);
                }
              }),

            update => update
              .transition().duration(500)
              .attr("cx", d => zx(d.fdi))
              .attr("cy", d => zy(d.trade))
              .attr("r", d => rScale(d.gdp))
              .attr("fill", bubbleColor),

            exit => exit.remove()
          );
      }

      update();

    }).catch(err => {
      console.error(err);
      container.append("div").text("Error loading data.");
    });
  }

  window.renderBubbleChart = renderBubbleChart;
})();