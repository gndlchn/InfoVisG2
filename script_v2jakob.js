// 1. GLOBAL STATE
window.vizState = {
    selectedCountry: "Austria",
    selectedYear: 2012,
    selectedContinent: "Europe",
    data: null
};

// 2. CENTRAL UPDATE FUNCTION
function updateAllPlots() {
    const yearLabel = document.getElementById("select_year-value");
    if (yearLabel) yearLabel.innerText = window.vizState.selectedYear;

    if (typeof updateMap === "function") updateMap();
    if (typeof updateWaterfall === "function") updateWaterfall(); // JAKOB'S PART
    if (typeof updateChart === "function") updateChart();         // TRADE PART
}

// 3. DATA LOADING & PARSING
d3.text("./merged(2).csv").then(raw => {
    // Jakob: We use your numeric parsing logic here to handle commas/NaNs
    const parseNum = (s) => {
        if (!s) return NaN;
        let v = String(s).replace(/,/g, ".");
        return parseFloat(v);
    };

    const data = d3.dsvFormat(";").parse(raw, d => ({
        region: d.continent,
        country: d["Country Name"],
        year: +d.Year,
        gdp: parseNum(d.GDP),
        exportsval: parseNum(d["Exports of goods and services (constant 2015 USD)"]),
        importsval: parseNum(d["Imports of goods and services (constant 2015 USD)"])
    }));

    window.vizState.data = data;

    // Listeners for filters
    document.getElementById("select_continent").addEventListener("change", (e) => {
        window.vizState.selectedContinent = e.target.value;
        updateAllPlots();
    });

    document.getElementById("select_year").addEventListener("input", (e) => {
        window.vizState.selectedYear = +e.target.value;
        updateAllPlots();
    });

    updateAllPlots();
});

// 4. JAKOB'S WATERFALL LOGIC (Integrated)
function updateWaterfall() {
    const country = window.vizState.selectedCountry;
    const allData = window.vizState.data;
    if (!allData) return;

    // Filter for the specific country and sort by year
    const countryData = allData.filter(d => d.country === country).sort((a, b) => a.year - b.year);
    
    // Prepare Waterfall steps
    let steps = [];
    for (let i = 0; i < countryData.length; i++) {
        const curr = countryData[i];
        if (i === 0) {
            steps.push({ name: curr.year, start: 0, end: curr.gdp, type: "total" });
        } else {
            const prev = countryData[i - 1];
            steps.push({ 
                name: curr.year, 
                start: prev.gdp, 
                end: curr.gdp, 
                type: curr.gdp >= prev.gdp ? "plus" : "minus" 
            });
        }
    }

    d3.select("#water_chart").selectAll("svg").remove();
    drawWaterfallSVG(steps);
}

function drawWaterfallSVG(data) {
    const container = d3.select("#water_chart").node();
    const width = container.getBoundingClientRect().width || 800;
    const height = 450;
    const margin = { top: 20, right: 30, bottom: 40, left: 80 };

    const svg = d3.select("#water_chart").append("svg")
        .attr("width", width).attr("height", height);

    const x = d3.scaleBand().domain(data.map(d => d.name)).range([margin.left, width - margin.right]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.end) * 1.1]).range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    g.selectAll(".bar").data(data).join("rect")
        .attr("x", d => x(d.name))
        .attr("y", d => y(Math.max(d.start, d.end)))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.abs(y(d.start) - y(d.end)))
        .attr("fill", d => d.type === "total" ? "#4682b4" : (d.type === "plus" ? "#2e8b57" : "#b22222"));

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues(x.domain().filter((d,i) => !(i%5))));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).tickFormat(d3.format(".2s")));
}

// 5. TRADE BAR CHART LOGIC
function updateChart() {
    // ... (Keep the Trade Bar Chart code from our previous chat here) ...
}

// Tab handling
document.getElementById('water-tab').addEventListener('shown.bs.tab', updateWaterfall);
document.getElementById('bar-tab').addEventListener('shown.bs.tab', updateChart);

<script src="./script.js"></script>
<script src="./script.js_v2jakob"></script>
