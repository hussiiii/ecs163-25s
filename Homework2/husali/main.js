const width = window.innerWidth;
const height = window.innerHeight;

const barMargin = { top: 50, right: 20, bottom: 70, left: 60 };
const barWidth = width * 0.4 - barMargin.left - barMargin.right;
const barHeight = height * 0.3 - barMargin.top - barMargin.bottom;
const barLeft = 0;
const barTop = 0;

const scatterMargin = { top: 50, right: 50, bottom: 70, left: 90 };
const scatterWidth = width * 0.6 - scatterMargin.left - scatterMargin.right;
const scatterHeight = height * 0.3 - scatterMargin.top - scatterMargin.bottom;
const scatterLeft = width * 0.4;
const scatterTop = 0;

const parCoordMargin = { top: 50, right: 50, bottom: 50, left: 50 };
const parCoordWidth = width - parCoordMargin.left - parCoordMargin.right;
const parCoordHeight = height * 0.7 - parCoordMargin.top - parCoordMargin.bottom;
const parCoordLeft = 0;
const parCoordTop = height * 0.3;

// Load the Pokémon dataset and create visualizations
d3.csv("data/pokemon_alopez247.csv").then(rawData => {
    // Parse numerical fields
    rawData.forEach(d => {
        d.Total = +d.Total;
        d.HP = +d.HP;
        d.Attack = +d.Attack;
        d.Defense = +d.Defense;
        d.Sp_Atk = +d.Sp_Atk;
        d.Sp_Def = +d.Sp_Def;
        d.Speed = +d.Speed;
        d.Catch_Rate = +d.Catch_Rate;
        d.isLegendary = d.isLegendary === "True";
    });

    // Select the SVG container and dashboard container
    const container = d3.select("#dashboard-container");
    const svg = container.select("svg");

    // --- BAR CHART ---
    // Create a group element for the bar chart
    const gBar = svg.append("g")
        .attr("transform", `translate(${barMargin.left + barLeft}, ${barMargin.top + barTop})`);

    // Compute counts by Type_1 and isLegendary
    const nestedData = d3.nest()
        .key(d => d.Type_1)
        .rollup(v => ({
            NonLegendary: v.filter(d => !d.isLegendary).length,
            Legendary: v.filter(d => d.isLegendary).length,
            Total: v.length
        }))
        .entries(rawData)
        .sort((a, b) => d3.descending(a.value.Total, b.value.Total));

    // Prepare data for stacking
    const stackKeys = ["NonLegendary", "Legendary"];
    const stackData = nestedData.map(d => ({
        Type_1: d.key,
        NonLegendary: d.value.NonLegendary,
        Legendary: d.value.Legendary,
        Total: d.value.Total
    }));

    // Create stack generator
    const stack = d3.stack()
        .keys(stackKeys)
        .value((d, key) => d[key]);

    const stackedData = stack(stackData);

    // Define scales for bar chart
    const xBar = d3.scaleBand()
        .domain(nestedData.map(d => d.key))
        .range([0, barWidth])
        .padding(0.1);

    const yBar = d3.scaleLinear()
        .domain([0, d3.max(nestedData, d => d.value.Total)])
        .range([barHeight, 0])
        .nice();

    const colorBar = d3.scaleOrdinal()
        .domain(stackKeys)
        .range(["#1f77b4", "#d62728"]); // Match colors with scatter and parallel coords

    // Add X axis to bar chart
    gBar.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${barHeight})`)
        .call(d3.axisBottom(xBar))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em");

    // Add Y axis to bar chart
    gBar.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yBar).ticks(5));

    // Add stacked bars to the chart
    gBar.selectAll("g.layer")
        .data(stackedData)
        .enter()
        .append("g")
        .attr("class", "layer")
        .attr("fill", d => colorBar(d.key))
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xBar(d.data.Type_1))
        .attr("y", d => yBar(d[1]))
        .attr("width", xBar.bandwidth())
        .attr("height", d => yBar(d[0]) - yBar(d[1]))
        .on("mouseover", function(event, d) {
            tooltip.classed("visible", true)
                .html(`<div><strong>Type:</strong> ${d.data.Type_1}</div>` +
                      `<div><strong>${d[1] - d[0] > 0 ? d.key : ""}:</strong> ${d[1] - d[0]}</div>`);
        })
        .on("mousemove", function(event) {
            const [mx, my] = d3.pointer(event, container.node());
            tooltip.style("left", (mx + 18) + "px")
                   .style("top", (my - 32) + "px");
        })
        .on("mouseleave", function() {
            tooltip.classed("visible", false);
        });

    // Add title to bar chart
    gBar.append("text")
        .attr("x", barWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .text("Pokémon Count by Type");

    // Add X axis label to bar chart
    gBar.append("text")
        .attr("x", barWidth / 2)
        .attr("y", barHeight + 60)
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Primary Type");

    // Add Y axis label to bar chart
    gBar.append("text")
        .attr("x", -barHeight / 2)
        .attr("y", -40)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Number of Pokémon");

    // Add legend for bar chart
    const legendBar = gBar.append("g")
        .attr("transform", `translate(${barWidth - 120}, -12)`);

    // Add legend items (rectangles and text) for bar chart
    stackKeys.forEach((key, i) => {
        legendBar.append("rect")
            .attr("x", 0)
            .attr("y", i * 20)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", colorBar(key));
        legendBar.append("text")
            .attr("x", 20)
            .attr("y", i * 20 + 12)
            .attr("class", "legend-text")
            .text(key);
    });

    // Create tooltip div for bar chart
    const tooltip = container.append("div")
        .attr("class", "bar-tooltip");

    // --- SCATTER PLOT ---
    // Create a group element for the scatter plot
    const gScatter = svg.append("g")
        .attr("transform", `translate(${scatterMargin.left + scatterLeft}, ${scatterMargin.top + scatterTop})`);

    // Define scales for scatter plot
    const xScatter = d3.scaleLinear()
        .domain([d3.min(rawData, d => d.Total), d3.max(rawData, d => d.Total)])
        .range([0, scatterWidth])
        .nice();

    const yScatter = d3.scaleLinear()
        .domain([0, d3.max(rawData, d => d.Catch_Rate)])
        .range([scatterHeight, 0])
        .nice();

    const colorScatter = d3.scaleOrdinal()
        .domain([false, true])
        .range(["#1f77b4", "#d62728"]); // Blue for non-legendary, red for legendary

    // Add X axis to scatter plot
    gScatter.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${scatterHeight})`)
        .call(d3.axisBottom(xScatter));

    // Add Y axis to scatter plot
    gScatter.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScatter).ticks(5))
        .selectAll("text")
        .style("font-size", "10px");

    // Add scatter points
    gScatter.selectAll(".point")
        .data(rawData)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", d => xScatter(d.Total))
        .attr("cy", d => yScatter(d.Catch_Rate))
        .attr("r", 5)
        .attr("fill", d => colorScatter(d.isLegendary))
        .attr("opacity", 0.7);

    // Add title to scatter plot
    gScatter.append("text")
        .attr("x", scatterWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .text("Total Stats vs. Catch Rate");

    // Add X axis label to scatter plot
    gScatter.append("text")
        .attr("x", scatterWidth / 2)
        .attr("y", scatterHeight + 40)
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Total Base Stats");

    // Add Y axis label to scatter plot
    gScatter.append("text")
        .attr("x", -scatterHeight / 2)
        .attr("y", -40)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("class", "axis-label")
        .text("Catch Rate");

    // Add legend for scatter plot
    const legendScatter = gScatter.append("g")
        .attr("transform", `translate(${scatterWidth - 100}, -20)`);

    // Add legend items (circles and text) for scatter plot
    [{ label: "Non-Legendary", value: false }, { label: "Legendary", value: true }].forEach((d, i) => {
        legendScatter.append("circle")
            .attr("cx", 10)
            .attr("cy", i * 20 + 10)
            .attr("r", 5)
            .attr("fill", colorScatter(d.value));
        legendScatter.append("text")
            .attr("x", 20)
            .attr("y", i * 20 + 14)
            .attr("class", "legend-text")
            .text(d.label);
    });

    // --- PARALLEL COORDINATES PLOT ---
    // Create a group element for the parallel coordinates plot
    const gParCoord = svg.append("g")
        .attr("transform", `translate(${parCoordMargin.left + parCoordLeft}, ${parCoordMargin.top + parCoordTop})`);

    const dimensions = ["HP", "Attack", "Defense", "Sp_Atk", "Sp_Def", "Speed"];

    // Define scales for parallel coordinates plot
    const yParCoord = {};
    dimensions.forEach(dim => {
        yParCoord[dim] = d3.scaleLinear()
            .domain([d3.min(rawData, d => +d[dim]), d3.max(rawData, d => +d[dim])])
            .range([parCoordHeight, 0]);
    });

    const xParCoord = d3.scalePoint()
        .domain(dimensions)
        .range([0, parCoordWidth])
        .padding(0.2);

    // Create line generator for parallel coordinates
    const line = d3.line()
        .x((d, i) => xParCoord(dimensions[i]))
        .y(d => yParCoord[d[0]](d[1]));

    // Add lines for each Pokémon
    gParCoord.selectAll(".line")
        .data(rawData)
        .enter()
        .append("path")
        .attr("class", "line")
        .attr("d", d => line(dimensions.map(dim => [dim, d[dim]])))
        .attr("stroke", d => colorScatter(d.isLegendary))
        .attr("stroke-width", 1)
        .attr("fill", "none")
        .attr("opacity", 0.3);

    // Add axes for parallel coordinates
    gParCoord.selectAll(".axis")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${xParCoord(d)}, 0)`)
        .each(function(d) { d3.select(this).call(d3.axisLeft(yParCoord[d]).ticks(5)); })
        .append("text")
        .attr("class", "axis-label")
        .attr("y", -10)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text(d => d);

    // Add title to parallel coordinates plot
    gParCoord.append("text")
        .attr("x", parCoordWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .attr("class", "title")
        .text("Pokémon Stats Comparison");

    // Add legend for parallel coordinates
    const legendParCoord = gParCoord.append("g")
        .attr("transform", `translate(${parCoordWidth - 750}, 10)`);

    // Add legend items (lines and text) for parallel coordinates
    [{ label: "Non-Legendary", value: false }, { label: "Legendary", value: true }].forEach((d, i) => {
        legendParCoord.append("line")
            .attr("x1", 0)
            .attr("y1", i * 20 + 10)
            .attr("x2", 20)
            .attr("y2", i * 20 + 10)
            .attr("stroke", colorScatter(d.value))
            .attr("stroke-width", 2);
        legendParCoord.append("text")
            .attr("x", 25)
            .attr("y", i * 20 + 14)
            .attr("class", "legend-text")
            .text(d.label);
    });

}).catch(error => {
    console.error("Error loading the dataset:", error);
});