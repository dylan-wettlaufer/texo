import type { ArchitectureNode, Diagram, Project } from "./types";

export const projects: Project[] = [
  { id: "atlas", name: "Atlas Commerce", description: "The services, data, and workflows behind a modern commerce platform.", language: "TypeScript", initials: "AC" },
  { id: "beacon", name: "Beacon Analytics", description: "An event analytics platform. A fresh space to map the system as it takes shape.", language: "Python", initials: "BA" },
];

const nodes: ArchitectureNode[] = [
  { id: "web", name: "Web application", description: "The storefront where customers browse products, manage their cart, and place orders.", technology: "Next.js · React", kind: "application", position: { x: 50, y: 220 } },
  { id: "api", name: "Commerce API", description: "Validates requests and coordinates the catalog, checkout, and order lifecycle.", technology: "Node.js · REST", kind: "service", position: { x: 370, y: 220 } },
  { id: "db", name: "Primary database", description: "Stores product inventory, customer records, and orders. The API and worker share this source of truth.", technology: "PostgreSQL", kind: "storage", position: { x: 690, y: 60 } },
  { id: "queue", name: "Order queue", description: "Buffers order events so fulfillment and notifications can run independently of checkout.", technology: "Redis · BullMQ", kind: "storage", position: { x: 690, y: 390 } },
  { id: "worker", name: "Order worker", description: "Processes queued orders, updates fulfillment status, and sends customer notifications.", technology: "Node.js · BullMQ", kind: "service", position: { x: 1010, y: 390 } },
  { id: "payments", name: "Payment provider", description: "An external payment service that authorizes and captures checkout payments.", technology: "External payment API", kind: "external", position: { x: 1010, y: 60 } },
];

function positionedNodes(positions: Record<string, { x: number; y: number }>) {
  return nodes.filter((node) => node.id in positions).map((node) => ({ ...node, position: positions[node.id] }));
}

export const diagrams: Diagram[] = [
  {
    id: "system", projectId: "atlas", name: "System overview", type: "System architecture",
    description: "A map of the storefront, core services, and the infrastructure that connects them.",
    nodes,
    edges: [
      { id: "web-api", source: "web", target: "api", label: "HTTPS requests" },
      { id: "api-db", source: "api", target: "db", label: "Read / write" },
      { id: "api-queue", source: "api", target: "queue", label: "Publish orders" },
      { id: "queue-worker", source: "queue", target: "worker", label: "Consume jobs" },
      { id: "worker-db", source: "worker", target: "db", label: "Update status" },
      { id: "api-payments", source: "api", target: "payments", label: "Authorize payment" },
    ],
  },
  {
    id: "dependencies", projectId: "atlas", name: "Service dependencies", type: "Service dependencies",
    description: "The resources each service relies on to keep commerce running.",
    nodes: positionedNodes({ api: { x: 60, y: 100 }, worker: { x: 60, y: 390 }, db: { x: 450, y: 60 }, queue: { x: 450, y: 390 }, payments: { x: 840, y: 220 } }),
    edges: [
      { id: "api-db", source: "api", target: "db", label: "Catalog & orders" },
      { id: "api-queue", source: "api", target: "queue", label: "Enqueue" },
      { id: "worker-db", source: "worker", target: "db", label: "Fulfillment state" },
      { id: "worker-queue", source: "worker", target: "queue", label: "Job subscription" },
      { id: "api-payments", source: "api", target: "payments", label: "Payment API" },
    ],
  },
  {
    id: "checkout", projectId: "atlas", name: "Checkout request", type: "Request flow",
    description: "Follow an order from the storefront through payment and asynchronous fulfillment.",
    nodes: positionedNodes({ web: { x: 40, y: 80 }, api: { x: 370, y: 80 }, payments: { x: 700, y: 80 }, db: { x: 370, y: 390 }, queue: { x: 700, y: 390 }, worker: { x: 1030, y: 390 } }),
    edges: [
      { id: "submit", source: "web", target: "api", label: "1 · Submit order" },
      { id: "pay", source: "api", target: "payments", label: "2 · Authorize" },
      { id: "store", source: "api", target: "db", label: "3 · Store order" },
      { id: "enqueue", source: "api", target: "queue", label: "4 · Publish order" },
      { id: "fulfill", source: "queue", target: "worker", label: "5 · Fulfill order" },
    ],
  },
];

export const getProject = (id: string) => projects.find((project) => project.id === id);
export const getProjectDiagrams = (projectId: string) => diagrams.filter((diagram) => diagram.projectId === projectId);
export const getDiagram = (projectId: string, diagramId: string) => diagrams.find((diagram) => diagram.projectId === projectId && diagram.id === diagramId);
