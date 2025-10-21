package frontend

// This package exists solely to prevent `go list` from failing when traversing the
// project tree. Wails invokes Go tooling commands that expect every directory to
// contain a compilable package, so we provide an empty package here.
