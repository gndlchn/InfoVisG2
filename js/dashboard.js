const state = {
  year: 2012,
  continent: "Europe"
};

function initFilters() {
  const yearInput = document.getElementById("select_year");
  const yearValue = document.getElementById("select_year-value");
  const continentSelect = document.getElementById("select_continent");

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
}

function renderAll() {
  if (typeof renderMapChart === "function") {
    renderMapChart("#map_chart", state);
  }

  if (typeof renderWaterChart === "function") {
    renderWaterChart("#water_chart", state);
  }

  if (typeof renderBubbleChart === "function") {
    renderBubbleChart("#bubble_chart", state);
  }

  if (typeof renderBarChart === "function") {
    renderBarChart("#bar_chart", state);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  renderAll();
});


