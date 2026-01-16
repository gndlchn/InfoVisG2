let dataByCountryYear;
let mapSvg, mapColor, mapPath, worldData;
let currentIndicator = ""; 

/**
 * Main function called by dashboard.js to render or update the Map
 * @param {string} containerId - The CSS selector for the container
 * @param {object} state - Global state { year, indicator, ... }
 * @param {string} displayName - Human-readable name of the indicator
 */
window.renderMapChart = function(containerId, state, displayName) {
  if (!dataByCountryYear) {
    Promise.all([ 
      d3.text("data/merged.csv"), 
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json") 
    ]).then(([raw, world]) => {
        const rawData = d3.dsvFormat(";").parse(raw);
        // Group raw data to support dynamic column switching
        dataByCountryYear = d3.group(rawData, d => d["Country Name"], d => +d.Year); 
        worldData = topojson.feature(world, world.objects.countries).features;
        
        drawMap(worldData, containerId, state); 
        updateMap(state, displayName);
    });
  } else {
    updateMap(state, displayName);
  }
};

function drawMap(countries, containerId, state) {
  const width = 900, height = 600;
  const tooltip = d3.select("#chart-tooltip");
  d3.select(containerId).selectAll("*").remove();

  mapSvg = d3.select(containerId).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");
  
  const mapTop = 80;
  const mapBottom = 540;

  mapSvg.append("defs")
    .append("clipPath")
    .attr("id", "map-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", mapTop)
    .attr("width", width)
    .attr("height", mapBottom - mapTop);

  const projection = d3.geoNaturalEarth1().scale(145).translate([width / 2, height / 2 - 20]);
  mapPath = d3.geoPath().projection(projection);

  const zoomGroup = mapSvg.append("g")
    .attr("class", "zoom-group")
    .attr("clip-path", "url(#map-clip)");

  const g = zoomGroup.append("g").attr("class", "countries");

  g.selectAll("path").data(countries).join("path")
    .attr("d", mapPath).attr("stroke", "#333").attr("fill", "#ccc")
    .style("cursor", "pointer") // Visual cue that countries are clickable
    .on("mouseover", function(event, d) { 
      d3.select(this).attr("stroke-width", 2); 
      const name = nameMap[d.properties.name.trim()] || d.properties.name.trim();
      const entry = dataByCountryYear.get(name)?.get(state.year);
      const val = entry ? +entry[0][state.indicator] : NaN;
      const displayVal = (isNaN(val) || val === 0) ? "No data" : d3.format(".2s")(val);

      tooltip.style("opacity", 1)
             .html(`<strong>${name}</strong><br>${state.indicator}: ${displayVal}`);
    })
    .on("mousemove", function(event) {
      tooltip.style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 10) + "px");
    })
    .on("mouseout", function() { 
      d3.select(this).attr("stroke-width", 1); 
      tooltip.style("opacity", 0);
    })
    .on("click", function(event, d) {
      const name = nameMap[d.properties.name.trim()] || d.properties.name.trim();
      const countryDataMap = dataByCountryYear.get(name);
      
      if (countryDataMap) {
        // Find the continent for this country from the data
        const firstYearEntry = countryDataMap.values().next().value[0];
        const continent = firstYearEntry.continent;
        
        // Update global filters and refresh all charts
        if (typeof window.updateFilters === "function") {
          window.updateFilters(name, continent);
        }
      }
    });

  mapSvg.append("g").attr("id", "map-legend-group").style("pointer-events", "none");;
  
  const zoom = d3.zoom()
    .scaleExtent([1, 8]) //zoom levels
    .translateExtent([
      [0, 60],              
      [width, height - 40]
    ])
    .on("zoom", (event) => {
      zoomGroup.attr("transform", event.transform);
    });
  
  mapSvg.call(zoom);

  mapSvg.style("cursor", "grab");
  mapSvg.on("mousedown", () => mapSvg.style("cursor", "grabbing"));
  mapSvg.on("mouseup mouseleave", () => mapSvg.style("cursor", "grab"));

}

function updateMap(state, displayName) {
  if (!mapSvg) return;

  d3.select("#map-title")
    .text(`${displayName} by country in ${state.year}`);

  // Rebuild color scale and legend if the indicator changes
  if (currentIndicator !== state.indicator) {
    currentIndicator = state.indicator;
    
    const allValues = [];
    dataByCountryYear.forEach(years => {
      years.forEach(entries => {
        const val = +entries[0][currentIndicator];
        if (!isNaN(val) && val !== 0) allValues.push(val);
      });
    });

    mapColor = d3.scaleQuantile().domain(allValues).range(d3.schemeBlues[7]);
    updateLegend(displayName); 
  }

  mapSvg.selectAll("path").transition().duration(300)
    .attr("fill", d => {
      const name = nameMap[d.properties.name.trim()] || d.properties.name.trim();
      const entry = dataByCountryYear.get(name)?.get(state.year);
      const val = entry ? +entry[0][currentIndicator] : NaN;
      // Handle missing or zero data with a neutral gray
      return (isNaN(val) || val === 0) ? "#ddd" : mapColor(val);
    });
}

function updateLegend(title) {
  const g = d3.select("#map-legend-group");
  g.style("pointer-events", "none");
  g.selectAll("*").remove();
  
  const width = 900, legendWidth = 240, legendHeight = 12;
  const xOffset = (width - legendWidth) / 2;
  const yOffset = 550; // Shifted slightly further down to avoid map overlap

  const legend = g.append("g").attr("transform", `translate(${xOffset}, ${yOffset})`);

  // Legend labels
  legend.append("text").attr("x", legendWidth / 2).attr("y", -15)
    .attr("text-anchor", "middle").style("font-size", "12px").style("font-family", "sans-serif")
    .style("fill", "black").text(title);

  legend.selectAll("rect").data(d3.schemeBlues[7]).join("rect")
    .attr("x", (d, i) => i * (legendWidth / 7)).attr("width", legendWidth / 7)
    .attr("height", legendHeight).attr("fill", d => d).attr("stroke", "#555").attr("stroke-width", 0.5);

  legend.append("text").attr("x", 0).attr("y", legendHeight + 20)
    .style("font-size", "12px").style("font-family", "sans-serif").style("fill", "black").text("Lower Values");
  
  legend.append("text").attr("x", legendWidth).attr("y", legendHeight + 20)
    .attr("text-anchor", "end").style("font-size", "12px").style("font-family", "sans-serif").style("fill", "black").text("Higher Values");
}

const nameMap = {
  "United States of America": "United States",
  "Russian Federation": "Russia",
  "Viet Nam": "Vietnam",
  "Côte d’Ivoire": "Cote d'Ivoire",
  "Syrian Arab Republic": "Syria",
  "Iran (Islamic Republic of)": "Iran",
  "Republic of Korea": "South Korea",
  "Democratic People's Republic of Korea": "North Korea",
  "Lao People's Democratic Republic": "Laos",
  "Congo": "Republic of the Congo",
  "Dem. Rep. Congo": "Democratic Republic of Congo",
  "United Republic of Tanzania": "Tanzania",
  "Bolivia (Plurinational State of)": "Bolivia",
  "Venezuela (Bolivarian Republic of)": "Venezuela",
  "Brunei Darussalam": "Brunei",
  "Egypt": "Egypt, Arab Rep."
};