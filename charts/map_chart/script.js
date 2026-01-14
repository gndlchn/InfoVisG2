// 1. Global Variables to keep track of the chart state
let gdpByCountryYear;
let mapSvg, mapColor, mapPath;
let worldData; // To store TopoJSON features

/**
 * Main function called by dashboard.js to render or update the Map
 * @param {string} containerId - The CSS selector for the container (e.g., "#map_chart")
 * @param {object} state - The global dashboard state { year, continent, country }
 */
window.renderMapChart = function(containerId, state) {
  
  // INITIALIZATION: If gdpByCountryYear is undefined, we need to load data and draw the map for the first time
  if (!gdpByCountryYear) {
    Promise.all([ 
      d3.text("data/merged.csv"), 
      // Using CDN for world atlas if local file is missing
      d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json") 
    ]).then(([raw, world]) => {
        
        // Data Parsing
        const data = d3.dsvFormat(";").parse(raw, d => ({
          region: d.continent,
          country: d["Country Name"],
          year: +d.Year,
          gdp: +d["GDP"]
        }));

        // Group data for quick lookup: [CountryName][Year]
        gdpByCountryYear = d3.group(data, d => d.country, d => d.year); 

        // Extract country features from TopoJSON
        worldData = topojson.feature(world, world.objects.countries).features;

        // Setup Color Scale based on all GDP values from 2010-2020
        const gdpValues = data 
          .filter(d => d.year >= 2010 && d.year <= 2020) 
          .map(d => d.gdp)
          .filter(v => Number.isFinite(v));

        mapColor = d3.scaleQuantile() 
          .domain(gdpValues) 
          .range(d3.schemeBlues[7]);

        // Draw the static elements of the map
        drawMap(worldData, containerId); 
        
        // Apply initial colors based on the current state's year
        updateMap(state.year); 
    }).catch(err => {
        console.error("Error loading map data:", err);
    });
  } 
  // UPDATE: If the map already exists, just update the colors for the new year
  else if (mapSvg) {
    updateMap(state.year);
  }
};

/**
 * Creates the SVG and draws the country paths
 */
function drawMap(countries, containerId) {
  const width = 900; 
  const height = 500;

  // Ensure container is empty before appending
  d3.select(containerId).selectAll("*").remove();

  mapSvg = d3.select(containerId)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const projection = d3.geoNaturalEarth1()
    .scale(160)
    .translate([width / 2, height / 2]);

  mapPath = d3.geoPath().projection(projection);
  
  const tooltip = d3.select("#map-tooltip");

  const g = mapSvg.append("g").attr("class", "countries");

  g.selectAll("path")
    .data(countries)
    .join("path")
    .attr("d", mapPath)
    .attr("stroke", "#333")
    .attr("fill", "#ccc")
    .attr("data-name", d => d.properties.name)
    .on("mouseover", function (event, d) {
       d3.select(this).attr("stroke-width", 2); 
       tooltip.style("opacity", 1) 
       .html(`<strong>${d.properties.name}</strong>`); 
    }) 
    .on("mousemove", function (event) { 
      tooltip.style("left", (event.pageX + 10) + "px") 
      .style("top", (event.pageY - 20) + "px"); 
    }) 
    .on("mouseout", function () { 
      d3.select(this).attr("stroke-width", 1); 
      tooltip.style("opacity", 0); 
    });

  // Zoom Logic
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [width, height]])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  mapSvg.call(zoom);
}

/**
 * Updates country colors based on the year
 */
function updateMap(year) {
  if (!mapSvg) return;

  mapSvg.selectAll("path")
    .transition()
    .duration(300)
    .attr("fill", d => {
      const name = d.properties.name.trim();
      const mappedName = nameMap[name] || name;
      const gdpEntry = gdpByCountryYear.get(mappedName)?.get(year);

      // Check if data exists for this country/year
      if (!gdpEntry || !gdpEntry[0] || !gdpEntry[0].gdp) return "#ddd";

      return mapColor(gdpEntry[0].gdp);
    });
}

// Mapping of TopoJSON names to CSV names
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
  "Cabo Verde": "Cape Verde",
  "Eswatini": "Swaziland",
  "Türkiye": "Turkey",
  "Myanmar": "Burma",
  "Falkland Is.": "Falkland Islands",
  "Egypt": "Egypt, Arab Rep."
};