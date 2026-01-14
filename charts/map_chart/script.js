

const parseTime = d3.timeParse("%Y");
let gdpByCountryYear;

Promise.all([ 
  d3.text("./merged.csv"), 
  d3.json("./countries-110m.json") ]).then(([raw, world]) => {
    
    const data = d3.dsvFormat(";").parse(raw, d => ({ // since merged(2).csv has ";" delimiter
      region: d.continent,
      country: d["Country Name"],
      year: +d.Year, //numeric
      gdp: +d["GDP"],
      exportsval: +d["Exports of goods and services (constant 2015 USD)"],//numeric
      importsval: +d["Imports of goods and services (constant 2015 USD)"]//numeric
    }));

    const countries = topojson.feature(world, world.objects.countries).features; // Build lookup: country → year → GDP 
    
    const csvNames = new Set(data.map(d => d.country.trim())); 
    const jsonNames = new Set(countries.map(d => d.properties.name.trim()));
    const missingInCSV = [...jsonNames].filter(name => !csvNames.has(name));
    console.log("Countries in TopoJSON but NOT in CSV:", missingInCSV);

    const missingInJSON = [...csvNames].filter(name => !jsonNames.has(name));
    console.log("Countries in CSV but NOT in TopoJSON:", missingInJSON);





    gdpByCountryYear = d3.group(data, d => d.country, d => d.year); 
    const gdpValues = data 
      .filter(d => d.year >= 2010 && d.year <= 2020) 
      .map(d => d.gdp)
      .filter(v => Number.isFinite(v));
    const gdpMin = d3.min(gdpValues);
    const gdpMax = d3.max(gdpValues);

    // mapColor = d3.scaleSequentialLog()
    //   .domain([gdpMin, gdpMax])
    //   .interpolator(d3.interpolateBlues);
    mapColor = d3.scaleQuantile() 
      .domain(gdpValues) 
      .range(d3.schemeBlues[7])


    drawMap(countries, gdpByCountryYear); 
    
    updateMap(+document.getElementById("select_year").value); 

    document.getElementById("select_year") 
      .addEventListener("input", e => updateMap(+e.target.value));


  // FIX: build lookup here 
    const continentToCountries = d3.group(data, d => d.region); // FIX: define updateCountrySelect here so it can see continentToCountries 
    
    function updateCountrySelect(continent) {
      const countrySelect = document.getElementById("select_country");

      // Clear old options
      countrySelect.innerHTML = "";

      const countries = continentToCountries.get(continent);
      if (!countries) return;

      // Add placeholder
      const placeholder = document.createElement("option");
      placeholder.textContent = "Select a country";
      placeholder.disabled = true;
      placeholder.selected = true;
      countrySelect.appendChild(placeholder);

      // Add new options
      const uniqueCountries = Array.from(new Set(countries.map(d => d.country)));
      uniqueCountries.forEach(country => {
        const opt = document.createElement("option");
        opt.value = country;
        opt.textContent = country;
        countrySelect.appendChild(opt);
      });

      countrySelectTS.clear();      // clears selection
      countrySelectTS.clearOptions(); // clears internal options
      countrySelectTS.addOption(
        uniqueCountries.map(c => ({ value: c, text: c }))
      );
      countrySelectTS.refreshOptions(false);
    }

    
      
    document.getElementById("select_continent") 
      .addEventListener("change", e => updateCountrySelect(e.target.value)); 
      
    const countrySelectTS = new TomSelect("#select_country", { 
      create: false, 
      sortField: "text", 
      placeholder: "Type to search..."
    });

    updateCountrySelect(document.getElementById("select_continent").value); 

    // updateChart(data); //when filter is changed, chart gets calculated again with new values
    document.getElementById("select_continent").addEventListener("change", () => updateChart(data)); //update chart with new region when selected
    document.getElementById("select_year").addEventListener("change", () => updateChart(data));//update chart with new year when selected
    
    const continentSelect = document.getElementById("select_continent");


    continentSelect.addEventListener("change", () => {
    updateCountrySelect(continentSelect.value);
    });



    console.log(d3.min(gdpValues));
    console.log(gdpMax);
    // console.log(data); //check if it works
    return data; //return so that newData can be created from data
})


const slider = document.getElementById("select_year");
const popup = document.getElementById("slider-popup");

function updatePopup() {
  const min = +slider.min;
  const max = +slider.max;
  const val = +slider.value;

  // position as percentage
  const percent = (val - min) / (max - min);

  // update text
  popup.textContent = val;

  // move bubble
  popup.style.left = `calc(${percent * 100}% )`;
}

slider.addEventListener("input", updatePopup);
updatePopup(); 


let mapSvg, mapColor, mapPath;

function drawMap(countries, gdpLookup) {
  const width = 900; 
  const height = 500;


  mapSvg = d3.select("#map_chart")
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


  mapSvg.append("g")
    .attr("class", "countries")
    .selectAll("path")
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


  const zoom = d3.zoom()
  .scaleExtent([1, 8])          // how far you can zoom
  .translateExtent([[0, 0], [width, height]]) // limit panning
  .on("zoom", (event) => {
    mapSvg.select(".countries")
      .attr("transform", event.transform);
  });

mapSvg.call(zoom);

}

function updateMap(year) {
  mapSvg.selectAll("path")
    .transition()
    .duration(300)
    .attr("fill", d => {
      let name = d.properties.name.trim();

      const mappedName = nameMap[name] || name;

      const gdpEntry = gdpByCountryYear.get(mappedName)?.get(year);

      if (!gdpEntry || !gdpEntry[0].gdp) return "#ddd";

      return mapColor(gdpEntry[0].gdp);
    });
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
  "Cabo Verde": "Cape Verde",
  "Eswatini": "Swaziland",
  "Türkiye": "Turkey",
  "Myanmar": "Burma",
  "Falkland Is.": "Falkland Islands",
  "Egypt": "Egypt, Arab Rep.",
  "eSwatini": "Eswatini",
  

};
