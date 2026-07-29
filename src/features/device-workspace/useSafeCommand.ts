import { useCallback, useState } from "react";
import {
  buildCommandConfirmation,
  type CommandConfirmation,
  type CommandKind,
} from "../../services/commandPolicy";

type CommandAction = () => void | Promise<void>;

interface PendingCommand {
  confirmation: CommandConfirmation;
  action: CommandAction;
}

export function useSafeCommand() {
  const [pending, setPending] = useState<PendingCommand | null>(null);

  const execute = useCallback(
    async (kind: CommandKind, payload: Record<string, unknown>, action: CommandAction) => {
      const confirmation = buildCommandConfirmation(kind, payload);
      if (confirmation === null) {
        setPending(null);
        await action();
        return;
      }

      setPending({ confirmation, action });
    },
    [],
  );

  const confirm = useCallback(async () => {
    if (pending === null) return;

    const { action } = pending;
    setPending(null);
    await action();
  }, [pending]);

  const cancel = useCallback(() => setPending(null), []);

  return {
    execute,
    confirmation: pending?.confirmation ?? null,
    confirm,
    cancel,
  };
}
