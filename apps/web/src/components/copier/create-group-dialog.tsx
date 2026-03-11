"use client";

import { useState } from "react";
import { useTRPC } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface MasterAccountOption {
  id: string;
  name: string;
  accountNumber: string | null;
}

const secondaryButtonClass =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white/60 hover:text-white text-xs duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5";
const primaryButtonClass =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-xs duration-250 rounded-sm px-5 border border-teal-400/20 bg-teal-400/12 text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-teal-400/20 hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none";
const selectTriggerClass = "border-white/5 rounded-sm bg-transparent text-white/60";
const selectContentClass = "rounded-sm border border-white/5 bg-sidebar-accent";

export function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const trpc = useTRPC() as any;
  const [name, setName] = useState("");
  const [masterAccountId, setMasterAccountId] = useState("");

  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery() as {
    data: MasterAccountOption[] | undefined;
    isLoading: boolean;
  };

  const createGroup = trpc.copier.createGroup.useMutation({
    onSuccess: () => {
      setName("");
      setMasterAccountId("");
      onCreated();
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !masterAccountId) return;
    createGroup.mutate({
      name: name.trim(),
      masterAccountId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-sidebar border border-white/5 rounded-md">
        <DialogHeader>
          <DialogTitle className="text-white">Create Copy Group</DialogTitle>
          <DialogDescription className="text-white/45">
            Select a master account to copy trades from. You can add slave accounts after creating the group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/75">Group Name</Label>
            <Input
              id="name"
              placeholder="e.g., Prop Challenge Copy"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="master" className="text-white/75">Master Account</Label>
            <Select value={masterAccountId} onValueChange={setMasterAccountId}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Select master account" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {accountsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-white/50" />
                  </div>
                ) : accounts && accounts.length > 0 ? (
                  accounts.map((account) => (
                    <SelectItem
                      key={account.id}
                      value={account.id}
                      className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span>{account.name}</span>
                        {account.accountNumber && (
                          <span className="text-xs text-white/50">({account.accountNumber})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="py-4 text-center text-sm text-white/50">
                    No accounts available
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-white/45">
              This account's trades will be copied to slave accounts.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button className={secondaryButtonClass} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={primaryButtonClass}
            onClick={handleCreate}
            disabled={!name.trim() || !masterAccountId || createGroup.isPending}
          >
            {createGroup.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
