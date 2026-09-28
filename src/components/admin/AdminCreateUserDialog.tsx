import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { AdminCreateUserForm, type CreatedAdminUser } from './AdminCreateUserForm';

type AdminCreateUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (created: CreatedAdminUser) => void;
};

export function AdminCreateUserDialog({ open, onOpenChange, onCreated }: AdminCreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" aria-hidden />
            Novo usuário
          </DialogTitle>
          <DialogDescription>
            Preencha os dados. O usuário poderá acessar o sistema com o e-mail e a senha definidos.
          </DialogDescription>
        </DialogHeader>
        <AdminCreateUserForm
          idPrefix="admin-create-dialog"
          showCancel
          onCancel={() => onOpenChange(false)}
          onSuccess={(created) => {
            onCreated?.(created);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
