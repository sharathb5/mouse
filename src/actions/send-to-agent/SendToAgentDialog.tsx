import { useEffect, useMemo, useState } from 'react';
import type { AgentDestination, SelectedContext, TrustedRule } from '@/core/contracts';
import { canCreateTask, findActiveTrustedRule } from '@/core/contracts';
import { createAgentTask, handoffToDestination, listDestinations } from './client';

export interface SendToAgentDialogProps {
  context: SelectedContext;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

export function SendToAgentDialog({ context, onClose, onCompleted }: SendToAgentDialogProps) {
  const [destinations, setDestinations] = useState<AgentDestination[]>([]);
  const [trustedRules, setTrustedRules] = useState<TrustedRule[]>([]);
  const [destinationId, setDestinationId] = useState<string>('');
  const [instructions, setInstructions] = useState('');
  const [rememberTrust, setRememberTrust] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listDestinations()
      .then((response) => {
        if (cancelled) return;
        setDestinations(response.destinations);
        setTrustedRules(response.trustedRules);
        const preferred =
          response.destinations.find((item) => item.isDefault)?.id ??
          response.destinations[0]?.id ??
          '';
        setDestinationId(preferred);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load destinations');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => destinations.find((item) => item.id === destinationId),
    [destinationId, destinations],
  );

  const trusted = useMemo(() => {
    if (!destinationId) return undefined;
    return findActiveTrustedRule(trustedRules, context.source.url, destinationId);
  }, [trustedRules, context.source.url, destinationId]);

  const needsApproval = Boolean(selected && canCreateTask(selected) && !trusted);

  async function submit(approved: boolean) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const input = {
        actionId: 'send-to-agent' as const,
        context,
        destinationId: selected.id,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      };

      if (canCreateTask(selected)) {
        if (needsApproval && !approved) {
          setError('Confirm to send this content to the agent.');
          setBusy(false);
          return;
        }
        const approval = trusted
          ? { kind: 'trusted-rule' as const, ruleId: trusted.id }
          : { kind: 'explicit' as const, approvedAt: new Date().toISOString() };
        const created = await createAgentTask({
          destinationId: selected.id,
          input,
          approval,
        });
        // Trust-rule creation from the content script is deferred to the Agents popup panel.
        onCompleted(
          created.externalUrl
            ? `Task queued. Open run: ${created.externalUrl}`
            : `Task ${created.taskId} queued — check the Inbox.`,
        );
      } else {
        const result = await handoffToDestination({ destinationId: selected.id, input });
        if (result.outcome.mode === 'prefill-opened') {
          onCompleted(`Opened ${selected.label}. Prefill handoffs are not tracked as tasks.`);
        } else if (result.outcome.mode === 'copied') {
          onCompleted('Prompt copied to the clipboard.');
        } else {
          onCompleted('Handoff completed.');
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
      setBusy(false);
    }
  }

  return (
    <div className="am-send" role="dialog" aria-modal="true" data-testid="send-to-agent-dialog">
      <header className="am-send-header">
        <h2>Send to Agent</h2>
        <button type="button" className="am-send-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      {loading ? (
        <p className="am-send-muted">Loading destinations…</p>
      ) : (
        <>
          <label className="am-send-field">
            <span>Destination</span>
            <select
              data-testid="send-destination"
              value={destinationId}
              onChange={(event) => setDestinationId(event.target.value)}
            >
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.label}
                  {destination.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="am-send-field">
            <span>Instructions (optional)</span>
            <textarea
              data-testid="send-instructions"
              rows={3}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="What should the agent do?"
            />
          </label>

          {selected && canCreateTask(selected) && (
            <p className="am-send-muted" data-testid="send-capability">
              Creates a tracked Cursor Cloud Agent task.
              {trusted ? ' Trusted rule applies.' : ' Requires approval.'}
            </p>
          )}
          {selected && !canCreateTask(selected) && (
            <p className="am-send-muted" data-testid="send-capability">
              Prefill / copy only — will not appear as a running task.
            </p>
          )}

          {needsApproval && (
            <label className="am-send-trust">
              <input
                type="checkbox"
                checked={rememberTrust}
                onChange={(event) => setRememberTrust(event.target.checked)}
              />
              Remember trust for this site (manage in popup)
            </label>
          )}

          {error && (
            <p className="am-send-error" role="alert" data-testid="send-error">
              {error}
            </p>
          )}

          <div className="am-send-actions">
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            {needsApproval ? (
              <button
                type="button"
                data-testid="send-approve"
                className="am-send-primary"
                disabled={busy || !selected}
                onClick={() => void submit(true)}
              >
                {busy ? 'Sending…' : 'Approve & send'}
              </button>
            ) : (
              <button
                type="button"
                data-testid="send-confirm"
                className="am-send-primary"
                disabled={busy || !selected}
                onClick={() => void submit(true)}
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
