let barData; // Global variable to store parsed data

/**
 * Main function called by dashboard.js
 */
window.renderBarChart = function(containerId, state) {
  // If data isn't loaded yet, fetch it
  if (!barData) {
    d3.text("data/merged.csv").then(raw => {
      barData = d3.dsvFormat(";").parse(raw, d => ({
        region: d.continent,
        country: d["Country Name"],
        year: +d.Year,
        exportsval: +d["Exports of goods and services (constant 2015 USD)"],
        importsval: +d["Imports of goods and services (constant 2015 USD)"]
      }));
      
      // Initial draw
      updateBarChart(containerId, state);
    });
  } else {
    // Just update if data is already there
    updateBarChart(containerId, state);
  }
};

function updateBarChart(containerId, state) {
  const selectedRegion = state.continent;
  const selectedYear = state.year;

  // Filter data based on dashboard state
  let filteredData = barData
    .filter(d => d.region === selectedRegion && d.year === selectedYear)
    .filter(d => Number.isFinite(d.exportsval) || Number.isFinite(d.importsval))
    .filter(d => d.exportsval > 0 || d.importsval > 0);

  // Clear previous version
  d3.select(containerId).selectAll("*").remove();

  if (filteredData.length === 0) {
    d3.select(containerId).html("<p class='text-center mt-5'>No trade data available for this selection.</p>");
    return;
  }

  const maxAbs = d3.max(filteredData, d => Math.max(Math.abs(d.exportsval || 0), Math.abs(d.importsval || 0)));
  
  createVerticalDivergingBarChart(filteredData, maxAbs, containerId);
}

const createVerticalDivergingBarChart = (data, maxAbs, containerId) => {
  const container = d3.select(containerId); 
  const width = container.node().clientWidth || 800; 
  const height = container.node().clientHeight || 400; 
  const margins = { top: 20, right: 30, bottom: 80, left: 140 }; 

  const svg = container.append("svg") 
    .attr("width", "100%") 
    .attr("height", "100%") 
    .attr("viewBox", `0 0 ${width} ${height}`) 
    .attr("preserveAspectRatio", "xMidYMid meet");

  const yScale = d3.scaleBand()
      .domain(data.map(d => d.country))
      .range([margins.top, height - margins.bottom])
      .padding(0.3);

  const xScale = d3.scaleLinear()
    .domain([-maxAbs, maxAbs])
    .range([margins.left, width - margins.right]);

  const colorScale = d3.scaleOrdinal()
    .domain(["Import","Export"])
    .range(["#808080", "#ff6600"]);

  // Use the map tooltip or a local one if needed
  const tooltip = d3.select("#map-tooltip");

  const chartG = svg.append("g");

  // Export Bars
  chartG.selectAll("rect.export")
      .data(data)
      .join("rect")
        .attr("class", "export")
        .attr("y", d => yScale(d.country))
        .attr("x", xScale(0))
        .attr("width", d => Math.abs(xScale(d.exportsval || 0) - xScale(0)))
        .attr("height", yScale.bandwidth())
        .attr("fill", colorScale("Export"))
        .on("mouseover", (event, d) => {
          tooltip.style("opacity", 1)
                 .html(`<strong>${d.country}</strong><br/>Exports: $${((d.exportsval || 0) / 1e9).toFixed(2)}B`);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

  // Import Bars
  chartG.selectAll("rect.import")
      .data(data)
      .join("rect")
        .attr("class", "import")
        .attr("y", d => yScale(d.country))
        .attr("x", d => xScale(-Math.abs(d.importsval || 0)))
        .attr("width", d => Math.abs(xScale(0) - xScale(Math.abs(d.importsval || 0))))
        .attr("height", yScale.bandwidth())
        .attr("fill", colorScale("Import"))
        .on("mouseover", (event, d) => {
          tooltip.style("opacity", 1)
                 .html(`<strong>${d.country}</strong><br/>Imports: $${((d.importsval || 0) / 1e9).toFixed(2)}B`);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

  // Axes
  const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d => (Math.abs(d) / 1e9) + "B");
  chartG.append("g")
    .attr("transform", `translate(0,${height - margins.bottom})`)
    .call(xAxis);

  const yAxis = d3.axisLeft(yScale);
  chartG.append("g")
    .attr("transform", `translate(${margins.left},0)`)
    .call(yAxis);

  // Center Line
  chartG.append("line")
    .attr("x1", xScale(0)).attr("x2", xScale(0))
    .attr("y1", margins.top).attr("y2", height - margins.bottom)
    .attr("stroke", "#000");

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width/2 - 50}, ${height - 40})`);

  colorScale.domain().forEach((d, i) => {
    const lg = legend.append("g").attr("transform", `translate(${i * 100}, 0)`);
    lg.append("rect").attr("width", 15).attr("height", 15).attr("fill", colorScale(d));
    lg.append("text").attr("x", 20).attr("y", 12).text(d).style("font-size", "12px");
  });
};