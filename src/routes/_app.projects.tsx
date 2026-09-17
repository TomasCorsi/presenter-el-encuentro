import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SongsProvider } from "@/features/songs/songs-context";

export const Route = createFileRoute("/_app/projects")({ component: L });

function L() { return (<SongsProvider><Outlet /></SongsProvider>); }
