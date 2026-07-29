import type {
  CardPlacement,
  CardSize,
  DashboardCardId,
  LayoutPage,
  MonitorCardId,
  PageLayout,
} from "../softuiTypes";

export type {
  CardPlacement,
  CardSize,
  DashboardCardId,
  LayoutPage,
  MonitorCardId,
  PageLayout,
} from "../softuiTypes";

const dashboardCardIds = new Set<DashboardCardId>([
  "connection",
  "sampling",
  "recording",
  "alerts",
  "deviceHealth",
  "recentSessions",
  "recentEvents",
]);

const monitorCardIds = new Set<MonitorCardId>([
  "liveChart",
  "model3d",
  "deviceState",
  "commandQueue",
  "motorSummary",
  "sensorSummary",
  "recentAlerts",
]);

const cardSizes = new Set<CardSize>(["1x1", "2x1", "1x2", "2x2"]);

export const defaultDashboardLayout: PageLayout = {
  schemaVersion: 1,
  cards: [
    { id: "connection", size: "1x1", visible: true },
    { id: "sampling", size: "1x1", visible: true },
    { id: "recording", size: "1x1", visible: true },
    { id: "alerts", size: "1x1", visible: true },
    { id: "deviceHealth", size: "2x1", visible: true },
    { id: "recentSessions", size: "2x1", visible: true },
    { id: "recentEvents", size: "2x1", visible: true },
  ],
};

export const defaultWorkspaceMonitorLayout: PageLayout = {
  schemaVersion: 1,
  cards: [
    { id: "liveChart", size: "2x2", visible: true },
    { id: "model3d", size: "2x2", visible: true },
    { id: "deviceState", size: "1x1", visible: true },
    { id: "commandQueue", size: "1x1", visible: true },
    { id: "motorSummary", size: "2x1", visible: true },
    { id: "sensorSummary", size: "2x1", visible: true },
    { id: "recentAlerts", size: "2x1", visible: true },
  ],
};

function defaultLayoutFor(page: LayoutPage): PageLayout {
  return page === "dashboard" ? defaultDashboardLayout : defaultWorkspaceMonitorLayout;
}

function cloneLayout(layout: PageLayout): PageLayout {
  return { ...layout, cards: layout.cards.map((card) => ({ ...card })) };
}

function isCardPlacement(value: unknown, allowedCardIds: Set<string>): value is CardPlacement {
  if (typeof value !== "object" || value === null) return false;

  const card = value as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    allowedCardIds.has(card.id) &&
    typeof card.size === "string" &&
    cardSizes.has(card.size as CardSize) &&
    typeof card.visible === "boolean" &&
    (card.id !== "connection" || card.visible)
  );
}

export function validateLayout(value: unknown, page: LayoutPage = "dashboard"): PageLayout {
  if (typeof value !== "object" || value === null) return cloneLayout(defaultLayoutFor(page));

  const layout = value as Record<string, unknown>;
  const allowedCardIds = page === "dashboard" ? dashboardCardIds : monitorCardIds;
  if (layout.schemaVersion !== 1 || !Array.isArray(layout.cards)) return cloneLayout(defaultLayoutFor(page));

  const cardIds = new Set<string>();
  for (const card of layout.cards) {
    if (!isCardPlacement(card, allowedCardIds) || cardIds.has(card.id)) {
      return cloneLayout(defaultLayoutFor(page));
    }
    cardIds.add(card.id);
  }

  return { schemaVersion: 1, cards: layout.cards.map((card) => ({ ...card })) };
}

function keyFor(username: string, page: LayoutPage): string {
  return `softui:layout:${username}:${page}`;
}

export function loadLayout(username: string, page: LayoutPage): PageLayout {
  const storedLayout = localStorage.getItem(keyFor(username, page));
  if (!storedLayout) return cloneLayout(defaultLayoutFor(page));

  try {
    return validateLayout(JSON.parse(storedLayout), page);
  } catch {
    return cloneLayout(defaultLayoutFor(page));
  }
}

export function saveLayout(username: string, page: LayoutPage, layout: PageLayout): void {
  localStorage.setItem(keyFor(username, page), JSON.stringify(validateLayout(layout, page)));
}

export function resetLayout(username: string, page: LayoutPage): void {
  localStorage.removeItem(keyFor(username, page));
}
