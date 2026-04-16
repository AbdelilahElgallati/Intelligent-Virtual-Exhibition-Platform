export const config = {
  planner: {
    cmd: "gemini",
    args: (task) => ["-p", task]
  },

  builder: {
    cmd: "copilot",
    args: (input) => [input]
  },

  reviewer: {
    cmd: "gemini",
    args: (code) => ["-p", `Review this code:\n${code}`]
  },
  
  tester: {
    cmd: "npm",
    args: ["test"]
  }
};