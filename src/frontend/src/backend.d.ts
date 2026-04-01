import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Script {
    created: Time;
    content: string;
    name: string;
    updated: Time;
}
export type Time = bigint;
export interface ScriptMetadata {
    created: Time;
    preview: string;
    name: string;
    updated: Time;
}
export interface ScriptInput {
    content: string;
}
export interface backendInterface {
    clearHistory(): Promise<void>;
    deleteScript(name: string): Promise<void>;
    getLastCommands(n: bigint): Promise<Array<[Time, string]>>;
    getScript(name: string): Promise<Script>;
    listScripts(): Promise<Array<ScriptMetadata>>;
    renameScript(oldName: string, newName: string): Promise<void>;
    saveScript(name: string, input: ScriptInput): Promise<void>;
    storeCommand(command: string): Promise<void>;
}
