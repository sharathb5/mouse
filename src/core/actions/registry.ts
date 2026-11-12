import {
  ACTION_IDS,
  ActionDefinitionSchema,
  type ActionAvailability,
  type ActionDefinition,
  type ActionEvent,
  type ActionId,
  type ActionInputFor,
} from '../contracts';
import { ACTION_CATALOG } from './catalog';

/**
 * Executes one action. Implementations live outside the menu (Workstreams A/B/C) and
 * must be replaceable without UI changes. Executors receive untrusted page context and
 * must treat it as data, never as instructions.
 */
export interface ActionExecutor<A extends ActionId = ActionId> {
  readonly actionId: A;
  execute(input: ActionInputFor<A>, signal: AbortSignal): AsyncIterable<ActionEvent>;
}

export type AnyActionExecutor = { [A in ActionId]: ActionExecutor<A> }[ActionId];

export interface ResolvedAction {
  definition: ActionDefinition;
  availability: ActionAvailability;
}

export interface ActionRegistry {
  list(): ResolvedAction[];
  get(id: ActionId): ResolvedAction;
  getExecutor<A extends ActionId>(id: A): ActionExecutor<A> | undefined;
  /** Resolves pinned ids in order, skipping ids that are not in the catalog. */
  resolve(ids: readonly string[]): ResolvedAction[];
}

export interface ActionRegistryOptions {
  definitions?: Readonly<Record<ActionId, ActionDefinition>>;
  executors?: readonly AnyActionExecutor[];
}

export const COMING_SOON_REASON = 'Not available yet. Coming in a future update.';

export function createActionRegistry(options: ActionRegistryOptions = {}): ActionRegistry {
  const definitions = options.definitions ?? ACTION_CATALOG;
  for (const id of ACTION_IDS) {
    const definition = ActionDefinitionSchema.parse(definitions[id]);
    if (definition.id !== id) {
      throw new Error(`Action definition key "${id}" does not match its id "${definition.id}"`);
    }
  }

  const executors = new Map<ActionId, AnyActionExecutor>();
  for (const executor of options.executors ?? []) {
    if (executors.has(executor.actionId)) {
      throw new Error(`Duplicate executor for action "${executor.actionId}"`);
    }
    executors.set(executor.actionId, executor);
  }

  const resolveOne = (id: ActionId): ResolvedAction => ({
    definition: definitions[id],
    availability: executors.has(id)
      ? { status: 'available' }
      : { status: 'coming-soon', reason: COMING_SOON_REASON },
  });

  const isActionId = (value: string): value is ActionId =>
    (ACTION_IDS as readonly string[]).includes(value);

  return {
    list: () => ACTION_IDS.map(resolveOne),
    get: resolveOne,
    getExecutor: <A extends ActionId>(id: A) => executors.get(id) as ActionExecutor<A> | undefined,
    resolve: (ids) => ids.filter(isActionId).map(resolveOne),
  };
}
