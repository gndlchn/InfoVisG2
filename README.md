# InfoVisG2


# Var names

* year slider id: select_year
* continent drop down id: select_continent
* country dropdown: select_country

Plot IDs:
* map: map_chart
* bubble: bubble_chart
* waterfall: water_chart
* bar: bar_chart



## tooltips
my tooltip implementation: 
* html:
	<style>
		.tooltip {
		position: absolute;
		background: white;
		border: 3px solid #26a4ff;
		padding: 5px 5px;
		font-size: 12px;
		opacity: 0; 
		}
	</style>
	<div class="tooltip" id="tooltip"></div>

* js:
  const tooltip = d3.select("#tooltip");

  .on("mouseover", function(event, d) { // tooltip
    tooltip
      .style("opacity", 1) // make visible
      .html(`<strong>${d.country}</strong><br/>Exports: ${ (Math.abs(d.exportsval) / 1_000_000_000).toFixed(2) + " bln."}`); //show country and rounded value
  })
  .on("mousemove", function(event) { //follow along with cursor
    tooltip
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 20) + "px");
  })
  .on("mouseout", function() { 
    tooltip.style("opacity", 0); // make invisible 
  });

1. google doc:
https://docs.google.com/document/d/1h4m-ENpHfHMkaSQmZw4_qK8vM2wkTDwY4EqWEE3gbrI/edit?tab=t.0
