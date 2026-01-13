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

    // These call the specific drawing functions below
    if (typeof updateMap === "function") updateMap();
    updateWaterfall(); 
    updateChart(); // This is the Trade Bar Chart
}

// 3. DATA LOADING
d3.text("./merged(2)_jakob.csv").then(raw => {
    const parseNum = (s) => {
        if (!s) return NaN;
        let v = String(s).replace(/\s/g, "").replace(/,/g, ".");
        return parseFloat(v);
    };

    const data = d3.dsvFormat(";").parse(raw, d => ({
        region: d.continent,
        country: d["Country Name"],
        year: +d.Year,
        gdp: parseNum(d.GDP),
        // Note: Check your CSV column names; some use US$ and some use USD
        exportsval: parseNum(d["Exports of goods and services (constant 2015 US$)"]),
        importsval: parseNum(d["Imports of goods and services (constant 2015 US$)"])
    }));

    window.vizState.data = data;

    // Filter Listeners
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

// 4. JAKOB'S WATERFALL LOGIC
function updateWaterfall() {
    const country = window.vizState.selectedCountry;
    const allData = window.vizState.data;
    if (!allData) return;

    const countryData = allData.filter(d => d.country === country).sort((a, b) => a.year - b.year);
    
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

    svg.append("g").selectAll("rect").data(data).join("rect")
        .attr("x", d => x(d.name))
        .attr("y", d => y(Math.max(d.start, d.end)))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.abs(y(d.start) - y(d.end)))
        .attr("fill", d => d.type === "total" ? "#4682b4" : (d.type === "plus" ? "#2e8b57" : "#b22222"));

    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickValues(x.domain().filter((d,i) => !(i%5))));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).tickFormat(d3.format(".2s")));
}

// 5. TRADE BAR CHART LOGIC (Diverging Bars)
function updateChart() {
    const data = window.vizState.data;
    if (!data) return;

    const year = window.vizState.selectedYear;
    const continent = window.vizState.selectedContinent;

    const filtered = data.filter(d => d.year === year && (continent === "All" || d.region === continent))
                        .filter(d => !isNaN(d.exportsval) && !isNaN(d.importsval));

    const maxVal = d3.max(filtered, d => Math.max(d.exportsval, d.importsval)) || 1e9;

    d3.select("#bar_chart").selectAll("svg").remove();
    
    const margin = {top: 20, right: 30, bottom: 40, left: 120};
    const width = d3.select("#bar_chart").node().getBoundingClientRect().width;
    const height = Math.max(450, filtered.length * 25);

    const svg = d3.select("#bar_chart").append("svg")
        .attr("width", width).attr("height", height);

    const x = d3.scaleLinear().domain([-maxVal, maxVal]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(filtered.map(d => d.country)).range([margin.top, height - margin.bottom]).padding(0.2);

    const tooltip = d3.select("#tooltip");

    // Bars
    const bars = svg.append("g");
    
    // Exports (Right side - Green)
    bars.selectAll(".bar-export").data(filtered).join("rect")
        .attr("x", x(0)).attr("y", d => y(d.country))
        .attr("width", d => x(d.exportsval) - x(0))
        .attr("height", y.bandwidth()).attr("fill", "#2e8b57")
        .on("mouseover", (e, d) => tooltip.style("opacity", 1).html(`Export: ${d3.format(".2s")(d.exportsval)}`))
        .on("mousemove", e => tooltip.style("left", (e.pageX+10)+"px").style("top", (e.pageY-20)+"px"))
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Imports (Left side - Red)
    bars.selectAll(".bar-import").data(filtered).join("rect")
        .attr("x", d => x(-d.importsval)).attr("y", d => y(d.country))
        .attr("width", d => x(0) - x(-d.importsval))
        .attr("height", y.bandwidth()).attr("fill", "#b22222")
        .on("mouseover", (e, d) => tooltip.style("opacity", 1).html(`Import: ${d3.format(".2s")(d.importsval)}`))
        .on("mousemove", e => tooltip.style("left", (e.pageX+10)+"px").style("top", (e.pageY-20)+"px"))
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Axes
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
       .call(d3.axisBottom(x).tickFormat(d => d3.format(".2s")(Math.abs(d))));
    svg.append("g").attr("transform", `translate(${x(0)},0)`).call(d3.axisLeft(y).tickSize(0).tickPadding(10));
}

// Tab handling
document.getElementById('water-tab').addEventListener('shown.bs.tab', updateWaterfall);
document.getElementById('bar-tab').addEventListener('shown.bs.tab', updateChart);
