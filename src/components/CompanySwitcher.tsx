import { useActiveCompany } from "@/hooks/useStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function CompanySwitcher() {
  const { companies, activeId, switchCompany, addCompany } = useActiveCompany();
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCompanyName.trim()) {
      const created = addCompany(newCompanyName.trim());
      switchCompany(created.id);
      setNewCompanyName("");
      setIsDialogOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 border-b bg-white">
      <Label className="text-xs uppercase text-black font-semibold tracking-wider px-2">
        Société Active
      </Label>

      <div className="flex items-center gap-2">
        <Select value={activeId} onValueChange={switchCompany}>
          <SelectTrigger className="w-full bg-white border border-gray-200 text-black shadow-sm focus:ring-0 focus:border-gray-400">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-black text-white">
                <Building2 className="h-3 w-3" />
              </div>

              <SelectValue
                placeholder="Sélectionner une société"
                className="text-black"
              />
            </div>
          </SelectTrigger>

          <SelectContent className="text-black">
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id} className="text-black">
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 border-gray-200"
            >
              <Plus className="h-4 w-4 text-black" />
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-white text-black">
            <DialogHeader>
              <DialogTitle className="text-black">
                Ajouter une société
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddCompany} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-black">
                  Nom de l'entreprise
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Alpha Distribution SARL"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="text-black border-gray-300 focus:border-gray-500"
                  autoFocus
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="bg-black text-white hover:bg-gray-800">
                  Créer la société
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}