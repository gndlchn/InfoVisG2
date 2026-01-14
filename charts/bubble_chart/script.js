(function () {

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const parseNum = v => {
    if (v === null || v === undefined || v === "") return NaN;
    if (typeof v === "number") return v;
    return parseFloat(String(v).replace(",", "."));
  };

  function renderBubbleChart(containerId) {

    const root = d3.select(containerId);
    root.selectAll("*").remove();

    const container = root.append("div")
      .attr("class", "bubble-container");

    const controls = container.append("div")
      .attr("class", "bubble-controls");

    const yearSelect = controls.append("select");
    const regionSelect = controls.append("select");

    const svgRoot = container.append("svg")
      .attr(
        "viewBox",
        `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
      )
      .attr("preserveAspectRatio", "xMidYMid meet");

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

    const legendContainer = container.append("div")
      .attr("class", "bubble-legend");

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

      const regions = [
        "Europe",
        "Asia",
        "Africa",
        "Oceania",
        "North America",
        "South America"
      ];

      const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(d3.schemeCategory10);

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
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .text("FDI Net Inflows (% of GDP)");

      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .text("Trade (% of GDP)");

      const years = [...new Set(data.map(d => d.year))].sort((a, b) => b - a);

      yearSelect.selectAll("option")
        .data(years)
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      regionSelect.selectAll("option")
        .data(["All Regions", ...regions])
        .join("option")
        .attr("value", d => d)
        .text(d => d);

      const zoom = d3.zoom()
        .scaleExtent([0.5, 20])
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
        const year = +yearSelect.property("value");
        const region = regionSelect.property("value");

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
              .attr("fill", d => colorScale(d.region))
              .append("title")
              .text(d =>
                `${d.country}
FDI: ${d.fdi}%
Trade: ${d.trade}%
GDP PPP: ${formatGDP(d.gdp)}`
              ),

            update => update
              .attr("cx", d => zx(d.fdi))
              .attr("cy", d => zy(d.trade))
              .attr("r", d => rScale(d.gdp))
              .attr("fill", d => colorScale(d.region))
              .select("title")
              .text(d =>
                `${d.country}
FDI: ${d.fdi}%
Trade: ${d.trade}%
GDP PPP: ${formatGDP(d.gdp)}`
              ),

            exit => exit.remove()
          );
      }

      update();
      yearSelect.on("change", update);
      regionSelect.on("change", update);

      const legend = legendContainer.selectAll(".legend-item")
        .data(regions)
        .join("div")
        .attr("class", "legend-item");

      legend.append("span")
        .text(d => d);

      legend.append("span")
        .attr("class", "legend-dot")
        .style("background-color", d => colorScale(d));

    }).catch(err => {
      console.error(err);
      container.append("div").text("Error loading data.");
    });
  }

  window.renderBubbleChart = renderBubbleChart;

})();
