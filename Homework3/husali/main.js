/*  HW-3 Interactive Pokémon Dashboard
    Hussain Ali ECS163. Homework 3
*/
const CSV_FILE = "data/pokemon_alopez247.csv";

const margin = { top: 30, right: 30, bottom: 30, left: 60 };

const ovSVG = d3.select("#ov-chart svg"),
      fcSVG = d3.select("#fc-chart svg"),
      adSVG = d3.select("#ad-chart svg"),
      tooltip = d3.select("#tooltip");

// Fixed dimensions
const W = +ovSVG.style("width").replace("px", "")  - margin.left - margin.right;
const H = +ovSVG.style("height").replace("px", "") - margin.top  - margin.bottom;

const colorLegendary = { false: "#1f77b4", true: "#d62728" };

const state = {
  selectedType : null,   // bar clicked
  brushedIds   : null    // Set(id) from scatter brush
};

let masterData, idIndex = new Map();

let xSc, ySc;           // original, static scales
let xCurr, yCurr;       // live scales (update on zoom)

let gBars, gScatter, gPara;

d3.csv(CSV_FILE, d => {
  // Parse each row of CSV data into a JavaScript object
  // Debug: log first row to see actual column names
  if (!window.debugged) {
    console.log("First row keys:", Object.keys(d));
    console.log("First row data:", d);
    window.debugged = true;
  }
  
  return {
    id         : +d.Number || +d["#"] || +d.number,  // Pokemon ID - try multiple possible column names
    Name       :  d.Name,                             // Pokemon name
    Type_1     :  d.Type_1,                          // Primary type
    Type_2     :  d.Type_2 || null,                  // Secondary type (null if none)
    isLegendary:  d.isLegendary === "True" || d.isLegendary === true || d.isLegendary === "TRUE",
    Total      : +d.Total,                           // Total stats
    Catch      : +d.Catch_Rate,                      // Catch rate
    HP         : +d.HP,                              // Individual stats
    Attack     : +d.Attack,
    Defense    : +d.Defense,
    Sp_Atk     : +d.Sp_Atk,
    Sp_Def     : +d.Sp_Def,
    Speed      : +d.Speed
  };
})
.then(data => {
  console.log("Loaded data sample:", data.slice(0, 5));
  masterData = data;
  
  data.forEach(r => idIndex.set(r.id, r));

  // Initialize all three visualizations
  drawBars();
  drawScatter();
  drawParallel();
  applyFilters();               // Apply initial filters (show all data)
})
.catch(console.error);

function drawBars() {
  const g = ovSVG.append("g")
                 .attr("transform", `translate(${margin.left},${margin.top})`);
  gBars = g;

  g.append("g").attr("class", "x-axis")
    .attr("transform", `translate(0,${H})`);
  g.append("g").attr("class", "y-axis");
  g.append("text")
    .attr("x", W/2).attr("y", -10)
    .attr("text-anchor", "middle")
    .text("Primary Type");

  updateBars();
}

function updateBars() {

  /* either the whole dataset, or the subset after any filter */
  const rowsForBars = (state.selectedType || state.brushedIds)
                      ? filterRows()
                      : masterData;

  /* roll-up counts from *those* rows */
  const counts = d3.rollups(
      rowsForBars,
      v => v.length,
      d => d.Type_1
    ).sort((a,b) => d3.descending(a[1], b[1]));

  const x = d3.scaleBand()
              .domain(counts.map(d => d[0]))
              .range([0, W]).padding(0.1);
  const y = d3.scaleLinear()
              .domain([0, d3.max(counts, d => d[1])]).nice()
              .range([H, 0]);

  gBars.select(".x-axis")
      .transition().duration(500)
      .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor", "end");

  gBars.select(".y-axis")
      .transition().duration(500)
      .call(d3.axisLeft(y).ticks(4));

  /* for colouring / opacity decisions */
  const clickedType   = state.selectedType;
  const brushedTypes  = state.brushedIds
        ? new Set([...state.brushedIds].map(id => idIndex.get(id).Type_1))
        : null;

  gBars.selectAll("rect.bar")
    .data(counts, d => d[0])
    .join(
      enter => enter.append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d[0]))
        .attr("width", x.bandwidth())
        .attr("y", H).attr("height", 0)
        .attr("cursor", "pointer")
        .on("click", (e,d) => {
          console.log("Bar clicked:", d[0]);
          state.selectedType = (state.selectedType === d[0]) ? null : d[0];
          state.brushedIds = null;  // Clear brush when clicking bar
          applyFilters();
        })
        .on("mouseenter", (e,d) =>{
          tooltip.style("display","block")
                 .html(`<strong>${d[0]}</strong><br>Count: ${d[1]}`);
        })
        .on("mousemove", e =>{
          tooltip.style("top",(e.pageY+8)+"px")
                 .style("left",(e.pageX+8)+"px");
        })
        .on("mouseleave", ()=>tooltip.style("display","none")),
      update => update
    )
    .transition().duration(500)
      .attr("x", d => x(d[0]))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d[1]))
      .attr("height", d => H - y(d[1]))
      /* colour priority: clicked > brushed-in > rest */
      .attr("fill", d =>{
        if (clickedType && clickedType === d[0]) return "#ef4444";   // red
        if (brushedTypes && brushedTypes.has(d[0]))  return "#4f46e5"; // blue
        return "#d1d5db";                                             // light-grey
      })
      .attr("stroke", d => clickedType === d[0] ? "#000" : "none")
      .attr("stroke-width", d => clickedType === d[0] ? 2 : 0)
      .attr("opacity", d =>{
        if (clickedType)                 return (clickedType === d[0]) ? 1 : 0.10;
        if (brushedTypes)                return brushedTypes.has(d[0]) ? 1 : 0.10;
        return 1;                        // no filter: full opacity
      });
}

function drawScatter() {
  // Create main group for scatter plot with margins
  const g = fcSVG.append("g")
                 .attr("transform", `translate(${margin.left},${margin.top})`);
  gScatter = g;
  
  // Add legend for legendary status
  const legendData = [
    { label: "Regular", color: colorLegendary[false] },
    { label: "Legendary", color: colorLegendary[true] }
  ];
  
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${W - 100}, 20)`);
    
  legend.selectAll("g")
    .data(legendData)
    .enter().append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)
    .each(function(d) {
      const item = d3.select(this);
      // Add colored circle
      item.append("circle")
        .attr("r", 5)
        .attr("cx", 0)
        .attr("cy", 0)
        .style("fill", d.color);
      // Add label text
      item.append("text")
        .attr("x", 10)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d.label);
    });

  /* original scales */
  xSc = d3.scaleLinear()
           .domain(d3.extent(masterData, d => d.Total)).nice()
           .range([0, W]);
  ySc = d3.scaleLinear()
           .domain([0, d3.max(masterData, d => d.Catch)]).nice()
           .range([H, 0]);

  xCurr = xSc;          // live scales start identical
  yCurr = ySc;

  // Add x-axis with label
  g.append("g").attr("class", "x-axis")
    .attr("transform", `translate(0,${H})`)
    .call(d3.axisBottom(xCurr));
    
  // Add y-axis with label  
  g.append("g").attr("class", "y-axis")
    .call(d3.axisLeft(yCurr));

  // Add x-axis label
  g.append("text")
    .attr("x", W/2).attr("y", H + 45)
    .attr("text-anchor", "middle")
    .text("Total Stats");

  // Add y-axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -45).attr("x", -H/2)
    .attr("text-anchor", "middle")
    .text("Catch Rate");

  // Create scatter plot points 
  g.selectAll("circle.point")
    .data(masterData, d => d.id).enter()
    .append("circle").attr("class", "point")
      .attr("r", 4)
      .attr("cx", d => xCurr(d.Total))
      .attr("cy", d => yCurr(d.Catch))
      .attr("fill", d => colorLegendary[d.isLegendary])
      .attr("stroke", "none")
      .style("opacity", 0.9)  // Start with full opacity
      .on("mouseenter",(e,d)=>{
        tooltip.style("display","block")
               .html(`<strong>${d.Name}</strong><br>Total: ${d.Total}<br>Catch Rate: ${d.Catch}<br>Type: ${d.Type_1}${d.Type_2 ? '/' + d.Type_2 : ''}`);
      })
      .on("mousemove",e=>{
        tooltip.style("top",(e.pageY+8)+"px")
               .style("left",(e.pageX+8)+"px");
      })
      .on("mouseleave",()=>tooltip.style("display","none"));

  /* brush */
  const brush = d3.brush()
      .extent([[0,0],[W,H]])
      .on("brush end", brushed);
  g.append("g").attr("class", "brush").call(brush);

  /* zoom */
  const zoom = d3.zoom()
      .scaleExtent([0.8,8])
      .on("zoom", ({transform})=>{
        xCurr = transform.rescaleX(xSc);
        yCurr = transform.rescaleY(ySc);

        g.select(".x-axis").call(d3.axisBottom(xCurr));
        g.select(".y-axis").call(d3.axisLeft(yCurr));

        g.selectAll("circle.point")
         .attr("cx", d => xCurr(d.Total))
         .attr("cy", d => yCurr(d.Catch));
      });
  g.append("rect")
    .attr("width",W).attr("height",H)
    .style("fill","none").style("pointer-events","all")
    .lower()
    .call(zoom);

  /* brush handler using live scales */
  function brushed({selection}) {
    if (!selection) {
      state.brushedIds = null;             // brush cleared
    } else {
      state.selectedType = null;           // clear any bar-click filter
  
      const [[px0,py0],[px1,py1]] = selection;
  
      const totMin   = xCurr.invert(Math.min(px0,px1));
      const totMax   = xCurr.invert(Math.max(px0,px1));
      const catchA   = yCurr.invert(py0),
            catchB   = yCurr.invert(py1);
      const catchMin = Math.min(catchA, catchB),
            catchMax = Math.max(catchA, catchB);
  
      state.brushedIds = new Set(
        masterData
          .filter(d =>
            d.Total >= totMin  && d.Total <= totMax &&
            d.Catch >= catchMin && d.Catch <= catchMax)
          .map(d => d.id)
      );
    }
    applyFilters();
  }
}

function drawParallel() {
  // Define dimensions (stats) to show in parallel coordinates
  const dims = ["HP","Attack","Defense","Sp_Atk","Sp_Def","Speed"];
  const pcW  = +adSVG.style("width").replace("px","") - margin.left - margin.right;
  const pcH  = 640 - margin.top - margin.bottom;
  adSVG.attr("height", pcH + margin.top + margin.bottom);

  // Create main group with margins
  const g = adSVG.append("g")
                 .attr("transform", `translate(${margin.left},${margin.top})`);
  gPara = g;
  
  // Add color legend for legendary status
  const legendData = [
    { label: "Regular Pokémon", color: colorLegendary[false] },
    { label: "Legendary Pokémon", color: colorLegendary[true] }
  ];
  
  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${pcW - 250}, 20)`);
    
  legend.selectAll("g")
    .data(legendData)
    .enter().append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)
    .each(function(d) {
      const item = d3.select(this);
      // Add colored line
      item.append("line")
        .attr("x1", 0).attr("x2", 20)
        .attr("y1", 0).attr("y2", 0)
        .style("stroke", d.color)
        .style("stroke-width", 2);
      // Add label
      item.append("text")
        .attr("x", 25)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d.label);
    });

  // Create y-scales for each dimension
  const y={};
  dims.forEach(dim=>{
    y[dim] = d3.scaleLinear()
               .domain(d3.extent(masterData,d=>d[dim])).nice()
               .range([pcH,0]);
  });
  
  // Create x-scale for positioning the axes
  const x = d3.scalePoint()
              .domain(dims).range([0,pcW]).padding(0.4);

  // Create axes for each dimension
  g.selectAll("g.axis")
   .data(dims).enter().append("g")
     .attr("class","axis")
     .attr("transform",d=>`translate(${x(d)},0)`)
     .each(function(d){ 
       // Draw axis
       d3.select(this).call(d3.axisLeft(y[d]).ticks(4)); 
     })
     .append("text")
       .attr("y",-10)
       .attr("text-anchor","middle")
       .style("fill", "#000")
       .style("font-weight", "bold")
       .text(d=> {
         // Make stat names more readable
         const labels = {
           "HP": "HP",
           "Attack": "Attack", 
           "Defense": "Defense",
           "Sp_Atk": "Sp. Attack",
           "Sp_Def": "Sp. Defense",
           "Speed": "Speed"
         };
         return labels[d] || d;
       });

  // Function to create path for each Pokemon
  const path = d => d3.line()(dims.map(p=>[x(p), y[p](d[p])]));

  // Draw lines for each Pokemon
  g.selectAll("path.line")
   .data(masterData,d=>d.id).enter()
   .append("path").attr("class","line")
     .attr("d",path)
     .attr("stroke",d=>colorLegendary[d.isLegendary]);
}

function filterRows(){
  let rows = masterData;
  
  if(state.selectedType) {
    rows = rows.filter(r => {
      const hasType = r.Type_1 === state.selectedType || 
                     (r.Type_2 && r.Type_2 === state.selectedType);
      return hasType;
    });
    console.log(`Filtering for type: ${state.selectedType}, found ${rows.length} Pokemon`);
  }
  
  if(state.brushedIds) {
    rows = rows.filter(r => state.brushedIds.has(r.id));
  }
  
  return rows;
}

function applyFilters(){
  const rows = filterRows();
  const ids  = new Set(rows.map(r=>r.id));
  
  console.log(`Applying filters: ${ids.size} Pokemon selected out of ${masterData.length}`);

  /* scatter - Make the opacity change VERY obvious */
  gScatter.selectAll("circle.point")
    .attr("stroke", d => ids.has(d.id) ? "black" : "none")
    .attr("stroke-width", d => ids.has(d.id) ? 1 : 0)
    .transition().duration(300)
      .style("opacity", d => {
        const shouldShow = ids.has(d.id);
        return shouldShow ? 1.0 : 0.05;  // Very low opacity for hidden
      })
      .attr("r", d => ids.has(d.id) ? 5 : 2);  // Also change size dramatically

  /* parallel */
  gPara.selectAll("path.line")
    .transition().duration(500)
      .style("opacity", d => ids.has(d.id) ? 0.5 : 0.02)
      .style("stroke-width", d => ids.has(d.id) ? 1.5 : 0.5);

  /* bars */
  updateBars();
  
  // Update chart title to show current filter
  const ovTitle = d3.select("#ov-chart h2");
  const fcTitle = d3.select("#fc-chart h2");
  
  if(state.selectedType) {
    ovTitle.text(`Overview • Pokémon Count by Type (Filtered: ${state.selectedType})`);
    fcTitle.text(`Focus • Total Stats vs Catch Rate (Showing ${ids.size} ${state.selectedType} types)`);
  } else if(state.brushedIds) {
    fcTitle.text(`Focus • Total Stats vs Catch Rate (${state.brushedIds.size} selected)`);
    ovTitle.text("Overview • Pokémon Count by Type");
  } else {
    ovTitle.text("Overview • Pokémon Count by Type");
    fcTitle.text("Focus • Total Stats vs Catch Rate");
  }
}