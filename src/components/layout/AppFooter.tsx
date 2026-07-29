interface AppFooterProps {
  items: string[];
}

export function AppFooter({ items }: AppFooterProps) {
  return (
    <footer className="app-footer" aria-label="运行摘要">
      {items.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
    </footer>
  );
}
