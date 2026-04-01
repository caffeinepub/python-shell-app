import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Script, ScriptMetadata } from "../backend";
import { useActor } from "./useActor";

export function useListScripts() {
  const { actor, isFetching } = useActor();
  return useQuery<ScriptMetadata[]>({
    queryKey: ["scripts"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listScripts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetScript(name: string | null) {
  const { actor, isFetching } = useActor();
  return useQuery<Script | null>({
    queryKey: ["script", name],
    queryFn: async () => {
      if (!actor || !name) return null;
      return actor.getScript(name);
    },
    enabled: !!actor && !isFetching && !!name,
  });
}

export function useInvalidateScripts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["scripts"] });
}
