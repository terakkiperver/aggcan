"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Settings, Plus, MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  USER_ROLE_LABELS,
  WORKER_JOB_TITLES,
  type UserRole,
  type WorkerJobTitle,
} from "@/lib/types";

interface UserRow {
  id: string;
  fullName: string;
  username: string;
  role: string;
  jobTitle: WorkerJobTitle | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

const roleBadgeColors: Record<string, string> = {
  admin: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  foreman: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  worker: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function SettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "worker",
    jobTitle: "" as WorkerJobTitle | "",
    phone: "",
  });
  const [newPassword, setNewPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!form.fullName || !form.username || !form.password || !form.role) {
      toast.error("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }
    if (form.role === "worker" && !form.jobTitle) {
      toast.error("Personel için unvan seçmelisiniz.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username,
          password: form.password,
          role: form.role,
          jobTitle: form.role === "worker" ? form.jobTitle : undefined,
          phone: form.phone || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Kullanıcı oluşturuldu.");
        setCreateOpen(false);
        setForm({
          fullName: "",
          username: "",
          password: "",
          role: "worker",
          jobTitle: "",
          phone: "",
        });
        fetchUsers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        toast.success("Şifre güncellendi.");
        setPasswordOpen(false);
        setNewPassword("");
        setSelectedUser(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "Bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      toast.success(user.isActive ? "Kullanıcı deaktif edildi." : "Kullanıcı aktif edildi.");
      fetchUsers();
    } else {
      toast.error("Bir hata oluştu.");
    }
  };

  const handleDelete = async (user: UserRow) => {
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Kullanıcı silindi.");
      fetchUsers();
    } else {
      toast.error("Bir hata oluştu.");
    }
  };

  const handleJobTitleChange = async (
    user: UserRow,
    title: WorkerJobTitle | null
  ) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle: title }),
    });
    if (res.ok) {
      toast.success("Personel ünvanı güncellendi.");
      fetchUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Bir hata oluştu.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Settings className="size-6" />
            Kullanıcı Yönetimi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kullanıcılar, roller ve şifre yönetimi
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Yeni Kullanıcı
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Kullanıcılar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Kullanıcı Adı</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Personel Ünvanı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Oluşturulma</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell className="font-mono text-sm">{user.username}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={roleBadgeColors[user.role] || ""}
                      >
                        {USER_ROLE_LABELS[user.role as UserRole] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.role === "worker" ? (
                        <Select
                          value={user.jobTitle ?? "none"}
                          onValueChange={(val) =>
                            handleJobTitleChange(
                              user,
                              val === "none" ? null : (val as WorkerJobTitle)
                            )
                          }
                        >
                          <SelectTrigger className="h-8 min-w-[180px]">
                            <SelectValue placeholder="Unvan seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Atanmamış</SelectItem>
                            {WORKER_JOB_TITLES.map((title) => (
                              <SelectItem key={title} value={title}>
                                {title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.isActive
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }
                      >
                        {user.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.createdAt), "dd MMM yyyy", { locale: tr })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex items-center justify-center rounded-md text-sm size-8 hover:bg-secondary text-muted-foreground cursor-pointer"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setPasswordOpen(true);
                            }}
                          >
                            Şifreyi Değiştir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                            {user.isActive ? "Deaktif Et" : "Aktif Et"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={() => handleDelete(user)}
                          >
                            Sil
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Kullanıcı bulunamadı.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Ad Soyad"
              />
            </div>
            <div className="space-y-2">
              <Label>Kullanıcı Adı</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="kullanici.adi"
              />
            </div>
            <div className="space-y-2">
              <Label>Şifre</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(val) =>
                  setForm((f) => {
                    const nextRole = val ?? "worker";
                    return {
                      ...f,
                      role: nextRole,
                      jobTitle: nextRole === "worker" ? f.jobTitle : "",
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Yönetici</SelectItem>
                  <SelectItem value="foreman">Ustabaşı</SelectItem>
                  <SelectItem value="worker">Personel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "worker" && (
              <div className="space-y-2">
                <Label>Personel Ünvanı</Label>
                <Select
                  value={form.jobTitle}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, jobTitle: (val as WorkerJobTitle) ?? "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unvan seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKER_JOB_TITLES.map((title) => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Telefon (opsiyonel)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="05xx xxx xx xx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordOpen(false);
            setNewPassword("");
            setSelectedUser(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Şifre Değiştir — {selectedUser?.fullName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Yeni Şifre</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Yeni şifre"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordOpen(false);
                setNewPassword("");
                setSelectedUser(null);
              }}
            >
              İptal
            </Button>
            <Button onClick={handleChangePassword} disabled={saving || !newPassword}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
