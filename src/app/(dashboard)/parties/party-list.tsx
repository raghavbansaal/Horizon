"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Party } from "@prisma/client";
import Link from "next/link";
import { Plus, Edit, Trash2, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addParty, deleteParty, editParty } from "./actions";

interface PartyListProps {
  initialParties: Party[];
}

export function PartyList({ initialParties }: PartyListProps) {
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "CUSTOMER" | "SUPPLIER">("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setParties(initialParties);
  }, [initialParties]);

  const filteredParties = parties.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "ALL" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  async function handleAdd(formData: FormData) {
    setIsLoading(true);
    const result = await addParty(formData);
    if (result.success) {
      if ((result as any).data) {
        const added = (result as any).data as Party;
        setParties((prev) =>
          [...prev, added].sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      setIsAddOpen(false);
    } else {
      alert((result as any).error || "Failed to add party");
    }
    setIsLoading(false);
  }

  async function handleEdit(formData: FormData) {
    if (!editingParty) return;
    setIsLoading(true);
    const result = await editParty(editingParty.id, formData);
    if (result.success) {
      if ((result as any).data) {
        const updated = (result as any).data as Party;
        setParties((prev) =>
          prev
            .map((p) => (p.id === updated.id ? updated : p))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }
      setEditingParty(null);
    } else {
      alert((result as any).error || "Failed to update party");
    }
    setIsLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this party?")) return;
    setIsLoading(true);
    const result = await deleteParty(id);
    if (result.success) {
      setParties((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert((result as any).error || "Failed to delete party");
    }
    setIsLoading(false);
  }

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search parties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(val: any) => setFilterType(val)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Parties</SelectItem>
              <SelectItem value="CUSTOMER">Customers</SelectItem>
              <SelectItem value="SUPPLIER">Suppliers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
            <Plus className="w-4 h-4 mr-2" />
            Add Party
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Party</DialogTitle>
            </DialogHeader>
            <form action={handleAdd} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input name="name" required placeholder="Party Name" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select name="type" required defaultValue="CUSTOMER">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Balance</label>
                <Input
                  name="balance"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  Positive: They owe you | Negative: You owe them
                </p>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Party"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Balance (₹)</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredParties.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                No parties found.
              </TableCell>
            </TableRow>
          ) : (
            filteredParties.map((party) => (
              <TableRow key={party.id}>
                <TableCell className="font-medium text-foreground">
                  {party.name}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      party.type === "CUSTOMER"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {party.type}
                  </span>
                </TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    party.balance > 0
                      ? "text-green-600"
                      : party.balance < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {party.balance > 0 ? "+" : ""}
                  {party.balance.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/parties/${party.id}`}
                      title="View Details & Price List"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingParty(party)}
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(party.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingParty}
        onOpenChange={(open) => !open && setEditingParty(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Party</DialogTitle>
          </DialogHeader>
          {editingParty && (
            <form action={handleEdit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  name="name"
                  required
                  defaultValue={editingParty.name}
                  placeholder="Party Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select name="type" required defaultValue={editingParty.type}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Balance</label>
                <Input
                  name="balance"
                  type="number"
                  step="0.01"
                  defaultValue={editingParty.balance}
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}