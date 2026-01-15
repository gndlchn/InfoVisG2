window.renderBarChart = function(containerId, state) {
  const margin = { top: 80, right: 30, bottom: 80, left: 140 };
  const totalWidth = 800;
  // const totalHeight = 400;
  // new
  const baseRowHeight = 25; 
  const dynamicHeight = Math.max(400, data.length * baseRowHeight); 
  const totalHeight = dynamicHeight; 
  const height = totalHeight - margin.top - margin.bottom;
  
  const width = totalWidth - margin.left - margin.right;
 // const height = totalHeight - margin.top - margin.bottom;

  const container = d3.select(containerId);
  const tooltip = d3.select("#chart-tooltip");
  container.selectAll("*").remove();

  const svgRoot = container.append("svg")
    .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Add centered dynamic title
  svgRoot.append("text")
    .attr("x", totalWidth / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .style("font-family", "sans-serif")
    .text(`Import vs Export of ${state.continent} in ${state.year}`);

  const g = svgRoot.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // --- 1. DEFINITIONS (Clips) ---
  const defs = svgRoot.append("defs");
  defs.append("clipPath").attr("id", "bar-chart-clip")
    .append("rect").attr("width", width).attr("height", height);
  defs.append("clipPath").attr("id", "bar-y-axis-clip")
    .append("rect").attr("x", -margin.left).attr("y", 0).attr("width", margin.left).attr("height", height);
  defs.append("clipPath").attr("id", "bar-x-axis-clip")
    .append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", margin.bottom);

  // --- 2. LAYOUT GROUPS ---
  const chartArea = g.append("g").attr("clip-path", "url(#bar-chart-clip)");
  const yAxisG = g.append("g").attr("clip-path", "url(#bar-y-axis-clip)");
  const xAxisG = g.append("g")
    .attr("transform", `translate(0,${height})`)
    .attr("clip-path", "url(#bar-x-axis-clip)");

  const colors = { export: "#0072B2", import: "#D55E00" };

  d3.text("data/merged.csv").then(raw => {
    const data = d3.dsvFormat(";").parse(raw, d => ({
      region: d.continent,
      country: d["Country Name"],
      year: +d.Year,
      exportsval: +d["Exports of goods and services (constant 2015 USD)"],
      importsval: +d["Imports of goods and services (constant 2015 USD)"]
    })).filter(d => d.region === state.continent && d.year === state.year && (d.exportsval > 0 || d.importsval > 0));

    if (data.length === 0) return;

    const yScale = d3.scaleBand().domain(data.map(d => d.country)).range([0, height]).padding(0.15);
    const maxVal = d3.max(data, d => Math.max(d.exportsval, d.importsval));
    const xScale = d3.scaleLinear().domain([-maxVal, maxVal]).range([0, width]).padding(0.45);

    // --- 3. ZOOM LOGIC ---
    const zoom = d3.zoom()
      .scaleExtent([1, 20])
      .extent([[0, 0], [width, height]])
      .translateExtent([[0, 0], [width, height]])
      .on("zoom", (event) => {
        const t = event.transform;
        const zx = t.rescaleX(xScale);
        const zy = yScale.copy().range([0, height].map(d => t.applyY(d)));

        xAxisG.call(d3.axisBottom(zx).tickFormat(d => Math.abs(d / 1e9) + "B"));
        yAxisG.call(d3.axisLeft(zy));

        chartArea.selectAll(".bar-exp")
          .attr("y", d => zy(d.country))
          .attr("x", zx(0))
          .attr("width", d => Math.abs(zx(d.exportsval) - zx(0)))
          .attr("height", zy.bandwidth());

        chartArea.selectAll(".bar-imp")
          .attr("y", d => zy(d.country))
          .attr("x", d => zx(-d.importsval))
          .attr("width", d => Math.abs(zx(0) - zx(-d.importsval)))
          .attr("height", zy.bandwidth());
      });

    svgRoot.call(zoom);

    // Initial Axis Render
    xAxisG.call(d3.axisBottom(xScale).tickFormat(d => Math.abs(d / 1e9) + "B"));
    yAxisG.call(d3.axisLeft(yScale));

    // Static Labels centered to the chart area
    const dashboardCenterX = width / 2;
    g.append("text")
      .attr("x", dashboardCenterX)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .text("Trade Volume (Billion USD)");

    // Bars with Tooltips & Clicks
    const handleBarClick = (event, d) => {
      if (typeof window.updateFilters === "function") {
        window.updateFilters(d.country, d.region);
      }
    };

    chartArea.selectAll(".bar-exp").data(data).join("rect").attr("class", "bar-exp")
      .attr("y", d => yScale(d.country))
      .attr("x", xScale(0))
      .attr("width", d => Math.abs(xScale(d.exportsval) - xScale(0)))
      .attr("height", yScale.bandwidth())
      .attr("fill", colors.export)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        tooltip.style("opacity", 1)
               .html(`<strong>${d.country}</strong><br>Exports: $${d3.format(".2s")(d.exportsval)}`);
      })
      .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
      })
      .on("click", handleBarClick);

    chartArea.selectAll(".bar-imp").data(data).join("rect").attr("class", "bar-imp")
      .attr("y", d => yScale(d.country))
      .attr("x", d => xScale(-d.importsval))
      .attr("width", d => Math.abs(xScale(0) - xScale(-d.importsval)))
      .attr("height", yScale.bandwidth())
      .attr("fill", colors.import)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        tooltip.style("opacity", 1)
               .html(`<strong>${d.country}</strong><br>Imports: $${d3.format(".2s")(d.importsval)}`);
      })
      .on("mousemove", function(event) {
        tooltip.style("left", (event.pageX + 10) + "px")
               .style("top", (event.pageY - 10) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
      })
      .on("click", handleBarClick);
    
    // Centered Legend centered to the chart area
    const legendData = [
      { l: "Export", c: colors.export, x: -50 },
      { l: "Import", c: colors.import, x: 50 }
    ];
    const legend = g.append("g")
      .attr("class", "legend-group")
      .attr("transform", `translate(${dashboardCenterX}, ${height + 60})`);

    const legendItems = legend.selectAll("g")
      .data(legendData)
      .join("g")
      .attr("transform", d => `translate(${d.x}, 0)`);

    legendItems.append("rect")
      .attr("x", -40)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", d => d.c);

    legendItems.append("text")
      .attr("x", -22)
      .attr("y", 10)
      .style("font-size", "12px")
      .text(d => d.l);
  });
};
