"use client";

import { useState, useEffect } from "react";
import { EventScheduleDay, EventScheduleSlot } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { 
  Plus, 
  Trash2, 
  Clock, 
  Video, 
  User, 
  Save, 
  XSquare,
  AlertCircle
} from "lucide-react";
import { organizerService } from "@/services/organizer.service";
import { apiClient } from "@/lib/api/client";

interface ScheduleEditorProps {
  eventId: string;
  initialDays: EventScheduleDay[];
  onSave: (updatedDays: EventScheduleDay[]) => void;
  onCancel: () => void;
}

export default function ScheduleEditor({ eventId, initialDays, onSave, onCancel }: ScheduleEditorProps) {
  const [days, setDays] = useState<EventScheduleDay[]>(JSON.parse(JSON.stringify(initialDays)));
  const [enterprises, setEnterprises] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnterprises = async () => {
      try {
        const data = await apiClient.get<any[]>(`/participants/event/${eventId}/enterprises`);
        setEnterprises(data.map(p => ({ 
          id: p.user_id, 
          name: p.organization_name || "Unknown Enterprise" 
        })));
      } catch (err) {
        console.error("Failed to fetch enterprises", err);
      }
    };
    fetchEnterprises();
  }, [eventId]);

  const handleUpdateSlot = (dayIndex: number, slotIndex: number, field: keyof EventScheduleSlot, value: any) => {
    const newDays = [...days];
    const slot = { ...newDays[dayIndex].slots[slotIndex], [field]: value };
    
    // If enterprise is changed, update the name too
    if (field === 'assigned_enterprise_id') {
      const ent = enterprises.find(e => e.id === value);
      slot.assigned_enterprise_name = ent ? ent.name : undefined;
      if (!slot.speaker_name) slot.speaker_name = slot.assigned_enterprise_name;
    }
    
    newDays[dayIndex].slots[slotIndex] = slot;
    setDays(newDays);
  };

  const handleAddSlot = (dayIndex: number) => {
    const newDays = [...days];
    newDays[dayIndex].slots.push({
      start_time: "09:00",
      end_time: "10:00",
      label: "New Slot",
      is_conference: false
    });
    setDays(newDays);
  };

  const handleRemoveSlot = (dayIndex: number, slotIndex: number) => {
    const newDays = [...days];
    newDays[dayIndex].slots.splice(slotIndex, 1);
    setDays(newDays);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await organizerService.updateEvent(eventId, { schedule_days: days });
      onSave(days);
    } catch (err: any) {
      setError(err.message || "Failed to save schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {days.map((day, dIdx) => (
        <Card key={day.day_number} className="border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 bg-zinc-50 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-indigo-100">
                {day.day_number}
              </span>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Day {day.day_number}</h3>
                {day.date_label && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{day.date_label}</p>}
              </div>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddSlot(dIdx)}
                className="rounded-xl h-9 border-zinc-200 text-zinc-600 hover:bg-white"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Slot
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {day.slots.map((slot, sIdx) => (
              <div key={sIdx} className="group relative bg-white border border-zinc-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Time Range */}
                  <div className="lg:col-span-3 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Time Range
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="time" 
                        value={slot.start_time} 
                        onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'start_time', e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      />
                      <span className="text-zinc-300">→</span>
                      <input 
                        type="time" 
                        value={slot.end_time} 
                        onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'end_time', e.target.value)}
                        className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Label / Description */}
                  <div className="lg:col-span-6 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Activity Label</label>
                    <input 
                      type="text" 
                      value={slot.label} 
                      onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'label', e.target.value)}
                      placeholder="e.g. Networking Lunch"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  {/* Conference Toggle */}
                  <div className="lg:col-span-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Video className="w-3 h-3" /> Conference
                        </label>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold ${slot.is_conference ? 'text-violet-600' : 'text-zinc-400'}`}>
                                {slot.is_conference ? 'Enabled' : 'Disabled'}
                            </span>
                            <button 
                                onClick={() => handleUpdateSlot(dIdx, sIdx, 'is_conference', !slot.is_conference)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${slot.is_conference ? 'bg-violet-600' : 'bg-zinc-200'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${slot.is_conference ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    {slot.is_conference && (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 p-3 bg-violet-50 rounded-xl border border-violet-100">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-violet-400 uppercase tracking-tighter">Assign Enterprise</label>
                          <select 
                            value={slot.assigned_enterprise_id || ""} 
                            onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'assigned_enterprise_id', e.target.value)}
                            className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-500/20"
                          >
                            <option value="">Select Enterprise...</option>
                            {enterprises.map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-violet-400 uppercase tracking-tighter flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> Speaker Name (Optional)
                          </label>
                          <input 
                            type="text" 
                            value={slot.speaker_name || ""} 
                            onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'speaker_name', e.target.value)}
                            placeholder="Defaults to Org Name"
                            className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-500/20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => handleRemoveSlot(dIdx, sIdx)}
                  className="absolute top-4 right-4 lg:relative lg:top-0 lg:right-0 lg:mt-4 lg:ml-auto p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {day.slots.length === 0 && (
              <div className="py-10 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl">
                <Clock className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">Empty day. Add your first time slot.</p>
              </div>
            )}
          </div>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-100">
        <Button 
            variant="outline" 
            onClick={onCancel} 
            disabled={loading}
            className="rounded-xl px-6 h-11 border-zinc-200 text-zinc-600"
        >
          Cancel
        </Button>
        <Button 
            onClick={handleSave} 
            isLoading={loading}
            className="rounded-xl px-10 h-11 bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100"
        >
          <Save className="w-4 h-4 mr-2" /> Save Schedule
        </Button>
      </div>
    </div>
  );
}
