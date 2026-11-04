import { useState, type FormEvent } from "react";
import { Cloud, KeyRound, LogOut, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useCloud } from "@/features/cloud/cloud-context";

export function CloudAccountSettings() {
  const cloud = useCloud();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void cloud.signIn(email, password);
  };

  const configured = cloud.configuration.state === "configured";
  const authenticated = cloud.auth === "authenticated";
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="size-4 text-primary" />
          Cuenta y nube
        </CardTitle>
        <CardDescription>
          Identidad cloud opcional. La operación y el contenido de este dispositivo siguen siendo locales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={configured ? "online" : cloud.configuration.state === "invalid" ? "offline" : "neutral"}>
            {configured ? "Configurado" : cloud.configuration.state === "invalid" ? "Configuración inválida" : "No configurado"}
          </StatusBadge>
          <StatusBadge tone={authenticated ? "online" : cloud.auth === "error" || cloud.auth === "expired" ? "offline" : "neutral"}>
            {authenticated ? "Autenticado" : cloud.auth === "initializing" ? "Iniciando" : cloud.auth === "expired" ? "Sesión expirada" : cloud.auth === "error" ? "Error Auth" : "Sin sesión"}
          </StatusBadge>
          <StatusBadge tone={cloud.reachability === "reachable" ? "online" : cloud.reachability === "unreachable" ? "offline" : "neutral"}>
            {cloud.reachability === "reachable" ? "Cloud disponible" : cloud.reachability === "checking" ? "Comprobando" : cloud.reachability === "unreachable" ? "Cloud no disponible" : "Cloud sin comprobar"}
          </StatusBadge>
        </div>

        {cloud.configuration.state === "unconfigured" ? (
          <p className="rounded-md border border-border bg-background/40 p-3 text-xs leading-5 text-muted-foreground">
            Configurá <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> para habilitar Cuenta y nube. La aplicación local funciona sin ellas.
          </p>
        ) : cloud.configuration.state === "invalid" ? (
          <p className="rounded-md border border-offline/40 bg-offline/10 p-3 text-xs text-offline-foreground">
            {cloud.configuration.message}
          </p>
        ) : authenticated ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-5">
              <p className="font-medium text-foreground">{cloud.user?.email ?? "Usuario autenticado"}</p>
              <p className="text-muted-foreground">
                Workspace: {cloud.identity?.workspace.name ?? "Pendiente de conexión"}
              </p>
              <p className="text-muted-foreground">
                Rol: {cloud.identity?.membership.role === "owner" ? "Owner" : cloud.identity?.membership.role === "operator" ? "Operator" : "—"}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2 rounded-md border border-border bg-background/40 p-3">
              <Button size="sm" variant="outline" disabled={cloud.busy} onClick={() => void cloud.retry()}>
                <RefreshCw /> Reintentar
              </Button>
              <Button size="sm" variant="outline" disabled={cloud.busy} onClick={() => void cloud.signOut()}>
                <LogOut /> Cerrar sesión
              </Button>
            </div>
          </div>
        ) : (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="cloud-email">Email</Label>
              <Input id="cloud-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cloud-password">Contraseña</Label>
              <Input id="cloud-password" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button size="sm" type="submit" disabled={cloud.busy}>Iniciar sesión</Button>
              <Button size="sm" type="button" variant="outline" disabled={cloud.busy} onClick={() => void cloud.signUp(email, password)}>Crear cuenta</Button>
              <Button size="sm" type="button" variant="ghost" disabled={cloud.busy || !email} onClick={() => void cloud.requestPasswordRecovery(email)}>
                Recuperar contraseña
              </Button>
              {cloud.auth === "expired" ? <Button size="sm" type="button" variant="outline" onClick={() => void cloud.retry()}><RefreshCw /> Reintentar sesión</Button> : null}
            </div>
          </form>
        )}

        {cloud.recovery ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-background/40 p-3">
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor="cloud-new-password">Nueva contraseña</Label>
              <Input id="cloud-new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
            <Button size="sm" disabled={cloud.busy || newPassword.length < 8} onClick={() => void cloud.updatePassword(newPassword)}>
              <KeyRound /> Actualizar contraseña
            </Button>
          </div>
        ) : null}

        {cloud.error ? <p role="alert" className="text-xs text-offline-foreground">{cloud.error}</p> : null}
        {cloud.notice ? <p role="status" className="text-xs text-success">{cloud.notice}</p> : null}

        <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
          Tus datos locales todavía no están vinculados ni sincronizados.
        </p>
      </CardContent>
    </Card>
  );
}
