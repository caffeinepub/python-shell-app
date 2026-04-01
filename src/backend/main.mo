import Time "mo:core/Time";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Order "mo:core/Order";
import List "mo:core/List";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";

actor {
  type Script = {
    name : Text;
    created : Time.Time;
    updated : Time.Time;
    content : Text;
  };

  type ScriptMetadata = {
    name : Text;
    created : Time.Time;
    updated : Time.Time;
    preview : Text;
  };

  // Scripts Storage
  module Script {
    public func compare(script1 : Script, script2 : Script) : Order.Order {
      Text.compare(script1.name, script2.name);
    };
  };

  let scripts = Map.empty<Text, Script>();

  public type ScriptInput = {
    content : Text;
  };

  func getScriptInternal(name : Text) : Script {
    switch (scripts.get(name)) {
      case (null) {
        Runtime.trap("Script does not exist");
      };
      case (?script) { script };
    };
  };

  func deleteScriptInternal(name : Text) {
    if (not scripts.containsKey(name)) {
      Runtime.trap("Script to delete does not exist");
    };
    scripts.remove(name);
  };

  // Save (create or update) script
  public shared ({ caller }) func saveScript(name : Text, input : ScriptInput) : async () {
    if (name.trim(#char ' ') == "") {
      Runtime.trap("Script name cannot be empty.");
    };
    let now = Time.now();
    let script : Script = switch (scripts.get(name)) {
      case (null) {
        // New script
        {
          name;
          created = now;
          updated = now;
          content = input.content;
        };
      };
      case (?existing) {
        // Update existing
        {
          name;
          created = existing.created;
          updated = now;
          content = input.content;
        };
      };
    };

    scripts.add(name, script);
  };

  // List scripts with metadata
  public query ({ caller }) func listScripts() : async [ScriptMetadata] {
    scripts.values().toArray().map(func(s) { s }).sort().map(
      func(s) {
        {
          name = s.name;
          created = s.created;
          updated = s.updated;
          preview = if (s.content.size() <= 50) {
            s.content;
          } else {
            s.content.toArray().sliceToArray(0, 50).toText();
          };
        };
      }
    );
  };

  // Get full script by name
  public query ({ caller }) func getScript(name : Text) : async Script {
    getScriptInternal(name);
  };

  // Delete script
  public shared ({ caller }) func deleteScript(name : Text) : async () {
    deleteScriptInternal(name);
  };

  // Rename script
  public shared ({ caller }) func renameScript(oldName : Text, newName : Text) : async () {
    if (not scripts.containsKey(oldName)) {
      Runtime.trap("Script to rename does not exist");
    };
    if (scripts.containsKey(newName)) {
      Runtime.trap("A script with the new name already exists");
    };
    if (newName.trim(#char ' ') == "") {
      Runtime.trap("New script name cannot be empty.");
    };
    // Delete old script
    let script = getScriptInternal(oldName);
    deleteScriptInternal(oldName);

    // Copy with new name
    let newScript : Script = {
      script with
      name = newName;
      updated = Time.now();
    };
    scripts.add(newName, newScript);
  };

  // Command History
  let MAX_HISTORY_SIZE = 50;
  let commandHistory = List.empty<(Time.Time, Text)>();

  // Store command
  public shared ({ caller }) func storeCommand(command : Text) : async () {
    // Add to front
    commandHistory.add((Time.now(), command));
    // Truncate if needed
    if (commandHistory.size() > MAX_HISTORY_SIZE) {
      let array = commandHistory.toArray();
      let truncated = array.sliceToArray(0, MAX_HISTORY_SIZE);
      commandHistory.clear();
      // Re-add
      for (entry in truncated.reverse().values()) {
        commandHistory.add(entry);
      };
    };
  };

  // Get last N commands
  public query ({ caller }) func getLastCommands(n : Nat) : async [(Time.Time, Text)] {
    commandHistory.toArray().sliceToArray(0, Nat.min(n, commandHistory.size()));
  };

  // Clear history
  public shared ({ caller }) func clearHistory() : async () {
    commandHistory.clear();
  };
};
