const state = {
  year: 2012,
  continent: "Europe",
  country: "",
  indicator: "GDP" 
};

// Indicators in the specific order with descriptions
const indicatorConfig = [
  { 
    name: "GDP", key: "GDP", 
    description: "Gross Domestic Product (GDP) represents the total market value of all finished goods and services produced within a country's borders. It serves as a comprehensive scorecard of a country’s economic health."
  },
  { 
    name: "GDP Growth", key: "GDP growth", 
    description: "This indicates the annual percentage rate of change in the value of the goods and services produced by an economy. It is a key indicator of economic expansion or contraction."
  },
  { 
    name: "GDP PPP", key: "GDP ppp", 
    description: "GDP at purchasing power parity (PPP) adjusts for the different costs of living and price levels between countries. This allows for a more accurate comparison of the relative size of economies."
  },
  { 
    name: "FDI Inflows", key: "Foreign direct investment. net inflows (% of GDP)", 
    description: "Investments made by foreign entities into domestic businesses. It reflects the country's attractiveness to international investors and capital."
  },
  { 
    name: "FDI Outflows", key: "Foreign direct investment. net outflows (% of GDP)", 
    description: "Investment that domestic companies and individuals make in other countries. It indicates the global expansion of a country's corporate sector."
  },
  { 
    name: "Import", key: "Imports of goods and services (constant 2015 USD)", 
    description: "The value of all goods and market services received by a country from the rest of the world. It shows the domestic demand for foreign products."
  },
  { 
    name: "Export", key: "Exports of goods and services (constant 2015 USD)", 
    description: "The value of all goods and market services provided by a country to the rest of the world. It reflects a country's production strength and competitiveness."
  },
  { 
    name: "Trade", key: "Trade (% of GDP)", 
    description: "Trade openness is the sum of exports and imports as a percentage of total GDP. It indicates how integrated a country's economy is with the global market."
  }
];

/**
 * Global helper to update country/continent filters from external components (like the map)
 * @param {string} country - The selected country name
 * @param {string} continent - The continent the country belongs to
 */
window.updateFilters = function(country, continent) {
  state.country = country;
  state.continent = continent;
  
  // Update the UI select elements to reflect the new state
  const countrySelect = document.getElementById("select_country");
  const continentSelect = document.getElementById("select_continent");
  
  if (countrySelect) countrySelect.value = country;
  if (continentSelect) continentSelect.value = continent;
  
  // Refresh all charts
  renderAll();
};

function initFilters() {
  const yearInput = document.getElementById("select_year");
  const yearValue = document.getElementById("select_year-value");
  const continentSelect = document.getElementById("select_continent");
  const countrySelect = document.getElementById("select_country");
  const indicatorSelect = document.getElementById("select_indicator");
  const descriptionDiv = document.getElementById("indicator_description");

  yearValue.textContent = state.year;

  yearInput.addEventListener("input", e => {
    state.year = +e.target.value;
    yearValue.textContent = state.year;
    renderAll();
  });

  continentSelect.addEventListener("change", e => {
    state.continent = e.target.value;
    renderAll();
  });

  countrySelect.addEventListener("change", e => {
    state.country = e.target.value;
    renderAll();
  });

  indicatorSelect.addEventListener("change", e => {
    state.indicator = e.target.value;
    // Update Description Text
    const cfg = indicatorConfig.find(c => c.key === state.indicator);
    descriptionDiv.textContent = cfg ? cfg.description : "";
    renderAll();
  });

  d3.text("data/merged.csv").then(raw => {
    const data = d3.dsvFormat(";").parse(raw);
    
    const countries = Array.from(new Set(data.map(d => d["Country Name"]))).sort();
    countries.forEach(c => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = c;
      countrySelect.appendChild(opt);
    });
    if (!state.country && countries.length > 0) {
      state.country = countries[0];
      countrySelect.value = countries[0];
    }

    indicatorConfig.forEach(ind => {
      const opt = document.createElement("option");
      opt.value = ind.key;
      opt.textContent = ind.name;
      if (ind.key === state.indicator) opt.selected = true;
      indicatorSelect.appendChild(opt);
    });

    // Set initial description
    const initialCfg = indicatorConfig.find(c => c.key === state.indicator);
    descriptionDiv.textContent = initialCfg ? initialCfg.description : "";

    renderAll();
  });
}

function renderAll() {
  const currentConfig = indicatorConfig.find(c => c.key === state.indicator);
  const displayName = currentConfig ? currentConfig.name : state.indicator;

  if (typeof renderMapChart === "function") renderMapChart("#map_chart", state, displayName);
  if (typeof renderWaterChart === "function") renderWaterChart("#water_chart", state, displayName);
  if (typeof renderBubbleChart === "function") renderBubbleChart("#bubble_chart", state, displayName);
  if (typeof renderBarChart === "function") renderBarChart("#bar_chart", state, displayName);
}

document.addEventListener("DOMContentLoaded", initFilters);