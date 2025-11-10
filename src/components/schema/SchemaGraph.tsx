import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Schema, Table, Column, ActiveTool } from '@/types';

interface SchemaGraphProps {
  schema: Schema | null;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  onAddTable: (position: { x: number; y: number }) => void;
  onAddConnection: (sourceTableId: string, targetTableId: string, type: '1-to-n' | 'n-to-n') => void;
  onUpdateTable: (tableId: string, newName: string) => void;
  onUpdateTablePosition: (tableId: string, position: { x: number; y: number }) => void;
  onAddColumn: (tableId: string) => void;
  onDeleteColumn: (tableId: string, columnId: string) => void;
  onDeleteTable: (tableId: string) => void;
  onUpdateColumnDetails: (tableId: string, columnId: string, updatedColumn: Column) => void;
  onOpenColumnEditor: (table: Table, column: Column, position: { x: number, y: number }) => void;
  searchQuery: string;
  highlightedIds: Set<string>;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  table: Table;
  width: number;
  height: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

type LinkType = '1-to-n' | 'n-to-n';

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: LinkType;
}

const TABLE_WIDTH = 200;
const TABLE_HEADER_HEIGHT = 45;
const COLUMN_HEIGHT = 28;
const TABLE_FOOTER_HEIGHT = 40;
const tableHeight = (table: Table) => TABLE_HEADER_HEIGHT + table.columns.length * COLUMN_HEIGHT + TABLE_FOOTER_HEIGHT;

const Minimap: React.FC<{
    nodes: GraphNode[];
    links: GraphLink[];
    transform: d3.ZoomTransform;
    onPan: (dx: number, dy: number) => void;
    viewportSize: { width: number; height: number };
}> = ({ nodes, links, transform, onPan, viewportSize }) => {
    const minimapRef = useRef<SVGSVGElement>(null);
    const MINIMAP_WIDTH = 200;
    const MINIMAP_HEIGHT = 150;

    const { scale, bounds } = useMemo(() => {
        if (nodes.length === 0) return { scale: 1, bounds: { minX: 0, minY: 0, width: 0, height: 0 }};
        
        const padding = 200;
        const minX = d3.min(nodes, n => (n.x ?? 0) - n.width / 2)! - padding;
        const minY = d3.min(nodes, n => (n.y ?? 0) - n.height / 2)! - padding;
        const maxX = d3.max(nodes, n => (n.x ?? 0) + n.width / 2)! + padding;
        const maxY = d3.max(nodes, n => (n.y ?? 0) + n.height / 2)! + padding;

        const boundsWidth = Math.max(maxX - minX, 1);
        const boundsHeight = Math.max(maxY - minY, 1);

        const scale = Math.min(MINIMAP_WIDTH / boundsWidth, MINIMAP_HEIGHT / boundsHeight);
        
        return { scale, bounds: { minX, minY, width: boundsWidth, height: boundsHeight }};
    }, [nodes]);

    useEffect(() => {
        if (!minimapRef.current) return;
        
        const svg = d3.select(minimapRef.current);
        const viewport = svg.select<SVGRectElement>('.minimap-viewport');

        const drag = d3.drag<SVGRectElement, unknown>()
            .on('start', event => event.sourceEvent.stopPropagation())
            .on('drag', event => {
                onPan(-event.dx / scale, -event.dy / scale);
            });
        
        viewport.call(drag);

    }, [scale, onPan]);

    if (nodes.length === 0) return null;

    const viewportX = (-transform.x / transform.k - bounds.minX) * scale;
    const viewportY = (-transform.y / transform.k - bounds.minY) * scale;
    const viewportW = (viewportSize.width / transform.k) * scale;
    const viewportH = (viewportSize.height / transform.k) * scale;

    return (
      <div className="absolute bottom-4 right-4 bg-gray-900/80 backdrop-blur-sm border border-gray-600 rounded-lg shadow-lg pointer-events-auto overflow-hidden">
        <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider px-3 pt-2">Overview</h4>
        <svg ref={minimapRef} width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} className="block">
          <g transform={`scale(${scale}) translate(${-bounds.minX}, ${-bounds.minY})`}>
            {links.map((link, i) => {
              const sourceNode = link.source as GraphNode;
              const targetNode = link.target as GraphNode;
              if (!sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) return null;
              return (
                <line
                  key={`minimap-link-${i}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  className="stroke-gray-500"
                  strokeWidth={1.5 / scale}
                />
              );
            })}
            {nodes.map(node => (
              <g key={node.id} transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}>
                 <title>{node.table.name}</title>
                 <rect
                    x={-node.width / 2}
                    y={-node.height / 2}
                    width={node.width}
                    height={node.height}
                    className="fill-blue-800/60"
                />
                <text
                    textAnchor="middle"
                    dy=".35em"
                    className="fill-gray-200 font-sans select-none"
                    fontSize={`${Math.min(20, 8 / scale)}px`}
                    style={{ display: scale > 0.04 ? 'block' : 'none', pointerEvents: 'none' }}
                >
                    {node.table.name}
                </text>
              </g>
            ))}
          </g>
          <rect
            className="minimap-viewport fill-blue-500/30 stroke-blue-400 stroke-2 cursor-move"
            x={viewportX}
            y={viewportY}
            width={viewportW}
            height={viewportH}
          />
        </svg>
      </div>
    );
};


const SchemaGraph: React.FC<SchemaGraphProps> = ({ 
    schema, activeTool, setActiveTool, onAddTable, onAddConnection,
    onUpdateTable, onUpdateTablePosition, onAddColumn, onDeleteColumn, onUpdateColumnDetails, onDeleteTable,
    onOpenColumnEditor, searchQuery, highlightedIds
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [transform, setTransform] = useState(() => d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [minimapState, setMinimapState] = useState<{nodes: GraphNode[], links: GraphLink[]}>({ nodes: [], links: [] });
  
  useEffect(() => {
    setConnectionSource(null);
  }, [activeTool]);

  const { nodes, links } = useMemo(() => {
    if (!schema) {
      return { nodes: [], links: [] };
    }
  
    const junctionTableIds = new Set<string>();
    const junctionLinks = new Map<string, { from: string; to: string }[]>();
  
    schema.tables.forEach(table => {
      const pks = table.columns.filter(c => c.isPrimaryKey);
      const fks = table.columns.filter(c => c.isForeignKey);
      if (table.columns.length === 2 && pks.length === 2 && fks.length === 2) {
        junctionTableIds.add(table.id!);
        junctionLinks.set(table.id!, fks.map(fk => ({ from: table.id!, to: fk.foreignKeyTable! })));
      }
    });
  
    const finalLinks: GraphLink[] = [];
    const tableMap = new Map(schema.tables.map(t => [t.name, t]));
  
    junctionTableIds.forEach(jId => {
      const fks = schema.tables.find(t => t.id === jId)!.columns.filter(c => c.isForeignKey);
      const table1 = tableMap.get(fks[0].foreignKeyTable!);
      const table2 = tableMap.get(fks[1].foreignKeyTable!);
      if (table1 && table2) {
        finalLinks.push({ source: table1.id!, target: table2.id!, type: 'n-to-n' });
      }
    });
  
    schema.tables.forEach(table => {
      if (junctionTableIds.has(table.id!)) return;
      table.columns.forEach(column => {
        if (column.isForeignKey && column.foreignKeyTable) {
          const targetTable = tableMap.get(column.foreignKeyTable);
          if (targetTable && !junctionTableIds.has(targetTable.id!)) {
            finalLinks.push({ source: table.id!, target: targetTable.id!, type: '1-to-n' });
          }
        }
      });
    });
    
    const finalNodes: GraphNode[] = schema.tables
      .filter(table => !junctionTableIds.has(table.id!))
      .map(table => ({
        id: table.id!,
        table,
        width: TABLE_WIDTH,
        height: tableHeight(table),
        fx: table.x,
        fy: table.y,
      }));
  
    return { nodes: finalNodes, links: finalLinks };
  }, [schema]);

  const handlePan = useCallback((dx: number, dy: number) => {
    if (svgRef.current && zoomBehaviorRef.current) {
        d3.select(svgRef.current).call(zoomBehaviorRef.current.translateBy, dx, dy);
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = svg.node()!.getBoundingClientRect();
    setViewportSize({ width, height });
    svg.selectAll("*").remove(); 

    const g = svg.append("g");

    svg.on('click', (event) => {
        if ((event.target === svg.node() || event.target === g.node()) && activeTool === 'addTable') {
            const [x, y] = d3.pointer(event, g.node());
            onAddTable({ x, y });
            setActiveTool('select');
        }
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .filter(event => activeTool === 'select' && !event.button && event.type !== 'dblclick')
      .on("zoom", (event) => { 
          g.attr("transform", event.transform); 
          setTransform(event.transform); 
      });

    svg.call(zoom).call(zoom.transform, transform);
    g.attr("transform", transform.toString());
    zoomBehaviorRef.current = zoom;

    if (nodes.length === 0) {
      setMinimapState({ nodes: [], links: [] });
      return;
    }

    const addColumnButtonY = (d: GraphNode) => TABLE_HEADER_HEIGHT + d.table.columns.length * COLUMN_HEIGHT + 7;

    const link = g.append("g")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("stroke", "#9ca3af")
        .attr("stroke-width", 1.5)
        .attr("fill", "none");

    const node = g.append("g")
      .selectAll("g")
      .data(nodes, (d: any) => d.id)
      .join("g")
      .attr("class", d => connectionSource === d.id ? "node-source" : null)
      .style("cursor", activeTool.startsWith('addConnection') ? 'cell' : (activeTool === 'select' ? 'pointer' : 'crosshair'))
      .style("transition", "opacity 0.3s ease")
      .style("opacity", d => (!searchQuery || highlightedIds.has(d.id!)) ? 1 : 0.2)
      .on("click", (event, d) => {
          event.stopPropagation();
          if (activeTool.startsWith('addConnection')) {
              if (!connectionSource) {
                  setConnectionSource(d.id);
              } else {
                  if (connectionSource !== d.id) {
                      const type = activeTool === 'addConnection-n-n' ? 'n-to-n' : '1-to-n';
                      onAddConnection(connectionSource, d.id, type);
                  }
                  setConnectionSource(null);
                  setActiveTool('select');
              }
          }
      })
      .on("mouseover", function() {
        if (activeTool === 'select') {
          d3.select(this).select(".delete-table-btn").style("opacity", 1);
        }
      })
      .on("mouseout", function() {
        d3.select(this).select(".delete-table-btn").style("opacity", 0);
      });
    
    node.append("rect")
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("fill", "#1f2937")
        .attr("stroke", d => connectionSource === d.id ? "#3b82f6" : "#4b5563")
        .attr("stroke-width", d => connectionSource === d.id ? 2 : 1.5)
        .attr("rx", 8);

    const tableNameGroup = node.append("g")
      .attr("class", "table-name-group");
      
    tableNameGroup.append("text")
        .text(d => d.table.name)
        .attr("x", d => d.width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .attr("fill", "#e5e7eb")
        .style("display", d => (editingTableId === d.table.id ? 'none' : 'block'))
        .style("cursor", "text")
        .on("dblclick", (e, d) => {
            e.stopPropagation();
            setEditingTableId(d.table.id!);
        });
    
    tableNameGroup.append("foreignObject")
        .attr("x", 10)
        .attr("y", 10)
        .attr("width", d => d.width - 20)
        .attr("height", 30)
        .style("display", d => (editingTableId === d.table.id ? 'block' : 'none'))
        .append("xhtml:input")
        .attr("class", "w-full bg-gray-800 text-center font-bold text-white p-1 rounded border border-blue-500 focus:outline-none")
        .each(function(d) {
            if (editingTableId !== d.table.id) return;
            const input = d3.select(this);
            let isCommitted = false;
            const commitChange = () => {
                if (isCommitted) return;
                isCommitted = true;
                const newValue = (input.node() as HTMLInputElement).value.trim();
                if (newValue && newValue !== d.table.name) {
                    onUpdateTable(d.table.id!, newValue);
                }
                setEditingTableId(null);
            };
            input
                .attr('value', d.table.name)
                .on('blur.commit', commitChange)
                .on('keydown.commit', (event) => {
                    if (event.key === 'Enter') { event.preventDefault(); commitChange(); } 
                    else if (event.key === 'Escape') { event.preventDefault(); setEditingTableId(null); }
                });
            setTimeout(() => { (input.node() as HTMLInputElement)?.focus(); (input.node() as HTMLInputElement)?.select(); }, 0);
        });
    
    const deleteTableButton = node.append("g")
        .attr("class", "delete-table-btn")
        .style("opacity", 0).style("cursor", "pointer").style("transition", "opacity 0.2s ease-in-out")
        .on("click", (e, d) => { e.stopPropagation(); onDeleteTable(d.id); });
    deleteTableButton.append("rect")
        .attr("x", d => d.width - 28).attr("y", 4).attr("width", 24).attr("height", 24).attr("fill", "transparent");
    deleteTableButton.append("svg").attr("x", d => d.width - 24).attr("y", 8).attr("width",16).attr("height",16).attr("viewBox","0 0 20 20").attr("fill","currentColor").attr("class","text-gray-500 hover:text-red-400 pointer-events-none")
        .append("path").attr("fill-rule", "evenodd").attr("d", "M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z").attr("clip-rule", "evenodd");


    node.append("line")
        .attr("x1", 10).attr("y1", TABLE_HEADER_HEIGHT - 5).attr("x2", d => d.width - 10).attr("y2", TABLE_HEADER_HEIGHT - 5).attr("stroke", "#4b5563");

    const columnGroup = node.selectAll(".column")
      .data(d => d.table.columns.map(c => ({ column: c, table: d.table })), (d: { column: Column }) => d.column.id!)
      .join("g")
      .attr("class", "column group")
      .attr("transform", (d, i) => `translate(10, ${i * COLUMN_HEIGHT + TABLE_HEADER_HEIGHT + 10})`)
      .style("cursor", "pointer")
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        onOpenColumnEditor(d.table, d.column, { x: event.clientX, y: event.clientY });
      });
      
    columnGroup.insert("rect", ":first-child")
        .attr("x", -5).attr("y", -12).attr("width", TABLE_WIDTH - 10).attr("height", COLUMN_HEIGHT - 4).attr("rx", 3)
        .attr("fill", d => highlightedIds.has(d.column.id!) ? 'rgba(59, 130, 246, 0.3)' : 'transparent')
        .style("transition", "fill 0.3s ease");


    const pkIcon = columnGroup.append("g").style("display", d => d.column.isPrimaryKey ? 'block' : 'none');
    pkIcon.append("title").text("Primary Key");
    pkIcon.append("svg").attr("viewBox", "0 0 20 20").attr("fill", "currentColor").attr("width", 14).attr("height", 14).attr("x", -1).attr("y", -11).attr("class", "text-yellow-400").append("path").attr("d", "M16.5 8h-1V6.5a4.5 4.5 0 10-9 0V8h-1a1.5 1.5 0 00-1.5 1.5v6A1.5 1.5 0 005.5 17h9a1.5 1.5 0 001.5-1.5v-6A1.5 1.5 0 0016.5 8zM10 14a1 1 0 110-2 1 1 0 010 2zm2-6h-4V6.5a2 2 0 114 0V8z");

    const fkIcon = columnGroup.append("g").style("display", d => d.column.isForeignKey ? 'block' : 'none');
    fkIcon.append("title").text(d => `Foreign Key to ${d.column.foreignKeyTable}.${d.column.foreignKeyColumn}`);
    fkIcon.append("svg").attr("viewBox", "0 0 20 20").attr("fill", "currentColor").attr("width", 14).attr("height", 14).attr("x", -1).attr("y", -11).attr("class", "text-blue-400").append("path").attr("d", "M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00-.233 5.385.75.75 0 001.11-1.007A2.5 2.5 0 019.5 7.56l3-3a2.5 2.5 0 01-.268-3.328zm-4.47 9.536a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 005.656 5.656l3-3a4 4 0 00-.233-5.385.75.75 0 00-1.11 1.007 2.5 2.5 0 012.268 3.328l-3 3z");

    const columnNameX = (d: { column: Column }) => d.column.isPrimaryKey || d.column.isForeignKey ? 18 : 5;
    
    columnGroup.append("foreignObject")
        .attr("x", d => columnNameX(d))
        .attr("y", -11)
        .attr("width", d => TABLE_WIDTH - columnNameX(d) - 40)
        .attr("height", 24)
        .style("pointer-events", "none")
        .append("xhtml:div")
        .attr("style", "display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; font-family: 'Roboto Mono', monospace; font-size: 13px;")
        .html(d => {
            const nameColor = d.column.isPrimaryKey ? "#fBBF24" : (d.column.isForeignKey ? "#60a5fa" : "#d1d5db");
            const nameStyle = `color: ${nameColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px;`;
            const typeStyle = `color: #9ca3af; flex-shrink: 0;`;
            return `
                <div style="${nameStyle}" title="${d.column.name}">${d.column.name}</div>
                <div style="${typeStyle}">${d.column.type}</div>
            `;
        });
    
    const deleteColumnButton = columnGroup.append("g").attr("class", "delete-column-btn opacity-0 group-hover:opacity-100").on("click", (e, d) => { e.stopPropagation(); onDeleteColumn(d.table.id!, d.column.id!); }).on("dblclick", (e) => e.stopPropagation()); 
    deleteColumnButton.append("rect").attr("x", TABLE_WIDTH - 48).attr("y", -12).attr("width", 28).attr("height", 24).attr("fill", "transparent");
    deleteColumnButton.append("svg").attr("x", TABLE_WIDTH-42).attr("y",-5).attr("width",16).attr("height",16).attr("viewBox","0 0 20 20").attr("fill","none").attr("stroke", "currentColor").attr("class","text-gray-500 hover:text-red-400").append("path").attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("stroke-width", "2").attr("d", "M6 18L18 6M6 6l12 12");

    const addColumnButton = node.append("g").attr("transform", d => `translate(10, ${addColumnButtonY(d)})`).attr("class", "cursor-pointer").on("click", (e, d) => { e.stopPropagation(); onAddColumn(d.id); });
    addColumnButton.append("rect").attr("width", TABLE_WIDTH - 20).attr("height", 25).attr("rx", 4).attr("class", "fill-gray-700/50 hover:fill-gray-600/50");
    addColumnButton.append("text").text("+ Add column").attr("x", (TABLE_WIDTH - 20) / 2).attr("y", 16).attr("text-anchor", "middle").attr("font-size", "12px").attr("class", "fill-gray-400");

    const simulation = d3.forceSimulation<GraphNode>(nodes)
        .force("link", d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(300).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-2000))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius((d: GraphNode) => Math.hypot(d.width, d.height) / 2 + 30).strength(1));

    const dragHandler = d3.drag<any, GraphNode>()
        .on("start", (event, d) => { 
            if (activeTool !== 'select' || editingTableId) return; 
            if (!event.active) simulation.alphaTarget(0.3).restart(); 
            d.fx = d.x; 
            d.fy = d.y; 
        })
        .on("drag", (event, d) => { 
            if (activeTool !== 'select' || editingTableId) return; 
            d.fx = event.x; 
            d.fy = event.y; 
        })
        .on("end", (event, d) => { 
            if (activeTool !== 'select' || editingTableId) return; 
            if (!event.active) simulation.alphaTarget(0); 
            if (d.x !== undefined && d.y !== undefined) { 
                onUpdateTablePosition(d.id, { x: d.x, y: d.y }); 
            }
            setMinimapState({ 
                nodes: [...simulation.nodes()], 
                links: [...simulation.force<d3.ForceLink<GraphNode, GraphLink>>('link')!.links()] 
            });
        })
        .filter(event => { 
            const target = event.target as HTMLElement; 
            const isInteractive = target.closest('.column') || target.closest('.cursor-pointer') || target.closest('.delete-table-btn') || target.closest('.table-name-group'); 
            return !event.button && activeTool === 'select' && !isInteractive && target.tagName.toLowerCase() !== 'input'; 
        });

    node.call(dragHandler);

    simulation.on("tick", () => {
        node.attr("transform", d => `translate(${(d.x ?? 0) - d.width / 2}, ${(d.y ?? 0) - d.height / 2})`);
        link.attr("d", d => getCrowFootPath(d as { source: GraphNode, target: GraphNode, type: LinkType }));
    });
    
    simulation.on("end", () => {
        setMinimapState({ 
            nodes: [...simulation.nodes()], 
            links: [...simulation.force<d3.ForceLink<GraphNode, GraphLink>>('link')!.links()] 
        });
    });
    
    if (minimapState.nodes.length === 0 && nodes.length > 0) {
       setMinimapState({ 
           nodes: [...nodes], 
           links: [...links] 
       });
    }

  }, [nodes, links, activeTool, connectionSource, onAddTable, onAddConnection, setActiveTool, editingTableId, onDeleteColumn, onAddColumn, onUpdateTable, onUpdateColumnDetails, onDeleteTable, onUpdateTablePosition, searchQuery, highlightedIds, handlePan, onOpenColumnEditor, transform]);
  
  const cursorClass = useMemo(() => {
    if (activeTool.startsWith('addConnection')) return 'cursor-cell';
    return {
        select: 'cursor-grab active:cursor-grabbing',
        addTable: 'cursor-crosshair',
    }[activeTool] || 'cursor-default';
  }, [activeTool]);

  return (
    <div className="w-full h-full relative overflow-hidden">
       {(!schema || schema.tables.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center h-full text-center text-gray-500 pointer-events-none">
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <h2 className="mt-4 text-2xl font-bold">vibedb</h2>
            <p className="mt-2">Import a DDL script or use the toolbox to add a table.</p>
          </div>
        </div>
      )}
      <svg ref={svgRef} className={`w-full h-full ${cursorClass}`}></svg>
      <Minimap 
        nodes={minimapState.nodes} 
        links={minimapState.links} 
        transform={transform} 
        onPan={handlePan} 
        viewportSize={viewportSize} 
      />
    </div>
  );
};

function getCrowFootPath(d: { source: GraphNode, target: GraphNode, type: LinkType }): string {
    const { source, target, type } = d;
    const p1 = { x: source.x!, y: source.y! };
    const p2 = { x: target.x!, y: target.y! };

    const intersect1 = getRectIntersection(p1, p2, { x: source.x!, y: source.y!, width: source.width, height: source.height });
    const intersect2 = getRectIntersection(p2, p1, { x: target.x!, y: target.y!, width: target.width, height: target.height });
    
    const dx = intersect2.x - intersect1.x;
    const dy = intersect2.y - intersect1.y;
    const angle = Math.atan2(dy, dx);
    
    let path = '';
    const lineStart = { ...intersect1 };
    let lineEnd = { ...intersect2 };
    
    const oneSymbolOffset = 2;

    if (type === '1-to-n' || type === 'n-to-n') {
        path += getCrowFootSymbol(intersect1, angle + Math.PI);
    }
    
    if (type === '1-to-n') {
        path += getOneSymbol(intersect2, angle);
        lineEnd.x -= oneSymbolOffset * Math.cos(angle);
        lineEnd.y -= oneSymbolOffset * Math.sin(angle);
    } else if (type === 'n-to-n') {
        path += getCrowFootSymbol(intersect2, angle);
    }
    
    path = `M ${lineStart.x} ${lineStart.y} L ${lineEnd.x} ${lineEnd.y}` + path;
    
    return path;
}

function getCrowFootSymbol(p: {x:number, y:number}, angle: number): string {
    const s = 12;
    const footAngle = Math.PI / 6;
    const x1 = p.x + s * Math.cos(angle - footAngle);
    const y1 = p.y + s * Math.sin(angle - footAngle);
    const x2 = p.x + s * Math.cos(angle + footAngle);
    const y2 = p.y + s * Math.sin(angle + footAngle);
    const x_center = p.x + s * Math.cos(angle);
    const y_center = p.y + s * Math.sin(angle);
    return ` M ${x1} ${y1} L ${p.x} ${p.y} L ${x2} ${y2} M ${p.x} ${p.y} L ${x_center} ${y_center}`;
}

function getOneSymbol(p: {x:number, y:number}, angle: number): string {
    const s = 10;
    const barAngle = angle + Math.PI / 2;
    const x1 = p.x + (s/2) * Math.cos(barAngle);
    const y1 = p.y + (s/2) * Math.sin(barAngle);
    const x2 = p.x - (s/2) * Math.cos(barAngle);
    const y2 = p.y - (s/2) * Math.sin(barAngle);
    return ` M ${x1} ${y1} L ${x2} ${y2}`;
}


function getRectIntersection(p1: {x: number, y: number}, p2: {x: number, y: number}, rect: {x: number, y: number, width: number, height: number}): {x: number, y: number} {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const { width, height } = rect;
    
    if (dx === 0 && dy === 0) return p1;

    const t = 0.5 / Math.max(Math.abs(dx) / width, Math.abs(dy) / height);
    
    return {
        x: p1.x + t * dx,
        y: p1.y + t * dy
    };
}


export default SchemaGraph;


