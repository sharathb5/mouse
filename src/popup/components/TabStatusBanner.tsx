import type { TabStatus } from '@/platform/tab-status';

export function TabStatusBanner({ status }: { status: TabStatus | null }) {
  if (!status) return null;
  switch (status.state) {
    case 'active':
      return (
        <p className="status status-ok" data-testid="tab-status" data-state="active">
          Ready on this page.
        </p>
      );
    case 'needs-reload':
      return (
        <p className="status status-warn" data-testid="tab-status" data-state="needs-reload">
          Reload this page to use Agentic Mouse here.
        </p>
      );
    case 'unsupported':
      return (
        <p className="status status-muted" data-testid="tab-status" data-state="unsupported">
          Not available on this page. {status.message}
        </p>
      );
  }
}
