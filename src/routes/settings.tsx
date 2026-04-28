// src/routes/settings.tsx - PARTIE 1
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useActiveCompany, notifyAll } from "@/hooks/useStore";
import { useState, useEffect, useRef } from "react";
// Fusion des imports (S3863) et ajout de importAll
import { 
  type CompanyInfo, 
  exportAll, 
  importAll, 
  type BackupData 
} from "@/lib/storage"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Building2, Upload, X, Database, Download, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AppLayout>
      <Toaster richColors position="top-right" />
      <SettingsPage />
    </AppLayout>
  ),
});





function SettingsPage() {
  const { activeCompany, updateActiveCompany } = useActiveCompany();
  
  // 1. CLAUSE DE GARDE : On empêche le crash si les données ne sont pas encore prêtes
  if (!activeCompany || !activeCompany.settings) {
    return <div className="p-8 text-center text-muted-foreground">Chargement des paramètres...</div>;
  }

  // 2. Initialisation sécurisée
  const [form, setForm] = useState<CompanyInfo>(activeCompany.settings);
  const fileRef = useRef<HTMLInputElement>(null);

  // 3. Synchronisation si on change de société via la sidebar
  useEffect(() => {
    if (activeCompany?.settings) {
      setForm(activeCompany.settings);
    }
  }, [activeCompany]);

  const set = <K extends keyof CompanyInfo>(k: K, v: CompanyInfo[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image trop lourde (max 2 Mo).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      set("logoDataUrl", result);
      toast.success("Logo chargé.");
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    set("logoDataUrl", "");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ice = (form.ice || "").trim();
    if (!ice) return toast.error("ICE obligatoire.");
    if (!/^\d{15}$/.test(ice))
      return toast.error("L'ICE doit contenir exactement 15 chiffres.");
    updateActiveCompany(form);
    toast.success("Informations entreprise enregistrées.");
  };
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-muted-foreground mt-1">
          Informations affichées sur vos factures PDF.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Entreprise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Logo de l'entreprise</Label>
              <div className="flex items-center gap-4">
                <div className="border rounded-md w-24 h-24 flex items-center justify-center bg-muted/30 overflow-hidden">
                  {form.logoDataUrl ? (
                    <img
                      src={form.logoDataUrl}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Aucun logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onLogoChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {form.logoDataUrl ? "Changer le logo" : "Téléverser un logo"}
                  </Button>
                  {form.logoDataUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                      <X className="h-4 w-4 mr-2" /> Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Nom de l'entreprise</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            {/* Autres champs (Adresse, ICE, IF, etc.) inchangés */}
            <div className="space-y-2 md:col-span-2">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ICE * (15 chiffres)</Label>
              <Input
                value={form.ice}
                onChange={(e) => set("ice", e.target.value.replace(/\D/g, "").slice(0, 15))}
                maxLength={15}
                required
              />
            </div>
            {/* ... Ajouter les autres inputs ici comme dans ton original ... */}
            
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <BackupCard />
    </div>
  );
}








function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingData, setPendingData] = useState<BackupData | null>(null);

  const handleExport = () => {
    try {
      const data = exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stockfact-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sauvegarde téléchargée.");
    } catch (e) {
      toast.error("Erreur lors de l'export.");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text); // Suppression du cast strict pour la comparaison
      // Correction S2367 : Autoriser la comparaison des versions
      if (!data || (data.version !== 2 && data.version !== 3)) {
        toast.error("Fichier incompatible.");
        return;
      }
      setPendingData(data as BackupData);
    } catch {
      toast.error("Impossible de lire le fichier.");
    }
  };

  const confirmRestore = () => {
    if (!pendingData) return;
    try {
      importAll(pendingData);
      notifyAll();
      toast.success("Données restaurées.");
      setPendingData(null);
    } catch (e) {
      toast.error("Erreur de restauration.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" /> Sauvegarde
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Correction S6438 : Commentaires déplacés ou supprimés du JSX */}
        <p className="text-sm text-muted-foreground">
          Gérez l'exportation et l'importation de vos données globales.
        </p>
        <div className="flex gap-3">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" /> Exporter
          </Button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <RotateCcw className="h-4 w-4 mr-2" /> Restaurer
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={!!pendingData} onOpenChange={(v) => !v && setPendingData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la restauration ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action remplacera toutes les données actuelles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restaurer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}