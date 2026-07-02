import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building, Plus, Edit2, Trash2, MapPin, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/apiClient";

export function RoomManagementTab() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    room_name: "",
    capacity: 10,
    location: "",
    status: "ACTIVE"
  });
  
  const { toast } = useToast();

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/meetings/rooms");
      setRooms(res.data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast({ title: "Failed to load rooms", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const openAddModal = () => {
    setEditingRoom(null);
    setFormData({
      room_name: "",
      capacity: 10,
      location: "",
      status: "ACTIVE"
    });
    setModalOpen(true);
  };

  const openEditModal = (room: any) => {
    setEditingRoom(room);
    setFormData({
      room_name: room.room_name,
      capacity: room.capacity,
      location: room.location || "",
      status: room.status
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_name.trim()) {
      toast({ title: "Room name is required", variant: "destructive" });
      return;
    }
    if (formData.capacity <= 0) {
      toast({ title: "Capacity must be greater than 0", variant: "destructive" });
      return;
    }

    try {
      if (editingRoom) {
        await apiClient.put(`/meetings/rooms/${editingRoom.id}`, formData);
        toast({ title: "Meeting room updated successfully" });
      } else {
        await apiClient.post("/meetings/rooms", formData);
        toast({ title: "Meeting room created successfully" });
      }
      setModalOpen(false);
      fetchRooms();
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || "Failed to save room";
      toast({ title: "Operation failed", description: errMsg, variant: "destructive" });
    }
  };

  const handleToggleStatus = async (room: any) => {
    const nextStatus = room.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiClient.put(`/meetings/rooms/${room.id}`, { status: nextStatus });
      toast({ title: `Room marked as ${nextStatus.toLowerCase()}` });
      fetchRooms();
    } catch (error) {
      toast({ title: "Failed to change room status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meeting room? This action cannot be undone.")) return;
    try {
      await apiClient.delete(`/meetings/rooms/${id}`);
      toast({ title: "Meeting room deleted successfully" });
      fetchRooms();
    } catch (error) {
      toast({ title: "Failed to delete room", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Meeting Rooms</h2>
          <p className="text-sm text-muted-foreground">Add and manage corporate meeting rooms</p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Meeting Room
        </Button>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="text-center py-12">Loading meeting rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-card">
          <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-lg">No meeting rooms found</p>
          <p className="text-sm">Click "Add Meeting Room" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`p-6 border rounded-xl bg-card shadow-sm hover:shadow-md transition duration-200 relative ${
                room.status === "INACTIVE" ? "opacity-60" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary" /> {room.room_name}
                  </h3>
                  {room.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3. h-3" /> {room.location}
                    </p>
                  )}
                </div>
                <Badge
                  variant={room.status === "ACTIVE" ? "default" : "secondary"}
                  className={room.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                >
                  {room.status}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-primary/70" /> Capacity: <strong className="text-foreground">{room.capacity}</strong>
                </span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t gap-2">
                <Button
                  onClick={() => handleToggleStatus(room)}
                  variant="outline"
                  size="sm"
                  className="flex-1 flex items-center justify-center gap-1 text-xs"
                >
                  {room.status === "ACTIVE" ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-green-600" /> Disable
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-muted-foreground" /> Enable
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => openEditModal(room)}
                  variant="outline"
                  size="sm"
                  className="flex items-center justify-center gap-1 text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  onClick={() => handleDelete(room.id)}
                  variant="destructive"
                  size="sm"
                  className="flex items-center justify-center gap-1 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Room Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Edit Meeting Room" : "Add Meeting Room"}</DialogTitle>
            <DialogDescription>
              Provide room details to configure the space for bookings.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="room_name" className="text-right">Room Name</Label>
              <Input
                id="room_name"
                value={formData.room_name}
                onChange={(e) => setFormData({ ...formData, room_name: e.target.value })}
                className="col-span-3"
                placeholder="e.g. Boardroom, Huddle Room Alpha"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="capacity" className="text-right">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                className="col-span-3"
                min="1"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="col-span-3"
                placeholder="e.g. 2nd Floor, East Wing"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <div className="col-span-3">
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingRoom ? "Save Changes" : "Create Room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
