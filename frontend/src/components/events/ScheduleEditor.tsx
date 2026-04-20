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
  AlertCircle,
  ArrowRight,
  Lock,
  Info,
  Calendar
} from "lucide-react";
import { organizerService } from "@/services/organizer.service";
import { apiClient } from "@/lib/api/client";
import { useTranslation } from "react-i18next";

interface ScheduleEditorProps {
  eventId: string;
  initialDays: EventScheduleDay[];
  startDate?: string;
  endDate?: string;
  timezone?: string;
  onSave: (updatedDays: EventScheduleDay[]) => void;
  onCancel: () => void;
}

export default function ScheduleEditor({ eventId, initialDays, startDate, endDate, timezone, onSave, onCancel }: ScheduleEditorProps) {
  const { t } = useTranslation();
  const [days, setDays] = useState<EventScheduleDay[]>(JSON.parse(JSON.stringify(initialDays)));
  const [enterprises, setEnterprises] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedRanges, setBlockedRanges] = useState<Record<number, { start: string, end: string, label: string }[]>>({});

  useEffect(() => {
    const blocked: Record<number, { start: string, end: string, label: string }[]> = {};
    days.forEach((day) => {
      day.slots.forEach(slot => {
        if (slot.end_time < slot.start_time) {
          const nextDayNum = day.day_number + 1;
          if (!blocked[nextDayNum]) blocked[nextDayNum] = [];
          blocked[nextDayNum].push({
            start: "00:00",
            end: slot.end_time,
            label: t('organizer.scheduleEditor.continuingSession', { label: slot.label || t('organizer.scheduleEditor.untitled') })
          });
        }
      });
    });
    setBlockedRanges(blocked);
  }, [days]);

  useEffect(() => {
    const fetchEnterprises = async () => {
      try {
        const data = await apiClient.get<any[]>(`/participants/event/${eventId}/enterprises`);
        setEnterprises(data.map(p => ({ 
          id: p.user_id, 
          name: p.organization_name || t('organizer.scheduleEditor.unknownEnterprise') 
        })));
      } catch (err) {
        console.error("Failed to fetch enterprises", err);
      }
    };
    fetchEnterprises();
  }, [eventId]);

  const getAbsTime = (dayNumber: number, timeStr: string) => {
    if (!startDate) return null;
    const eventStart = new Date(startDate);
    const baseDate = new Date(eventStart);
    baseDate.setHours(0, 0, 0, 0); 
    const dayDate = new Date(baseDate.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
    const [h, m] = timeStr.split(':').map(Number);
    const abs = new Date(dayDate);
    abs.setHours(h, m, 0, 0);
    return abs;
  };

  const isSlotPassed = (dayNumber: number, endTime: string) => {
    const absEnd = getAbsTime(dayNumber, endTime);
    if (!absEnd) return false;
    // Handle wrap-around end time for cross-day sessions
    if (endTime < "06:00") absEnd.setDate(absEnd.getDate() + 1); 
    const now = new Date();
    return absEnd < now;
  };

  const isDayPassed = (dayNumber: number) => {
    // A day is considered passed if its 11:59 PM timestamp is in the past
    return isSlotPassed(dayNumber, "23:59");
  };

  const getSlotConflict = (dayIndex: number, slotIndex: number) => {
    const day = days[dayIndex];
    const slot = day.slots[slotIndex];
    if (!slot.start_time || !slot.end_time) return null;

    const start = slot.start_time;
    const end = slot.end_time;
    
    // 1. Check against event global start/end
    if (startDate) {
        const absStart = getAbsTime(day.day_number, start);
        const eventStart = new Date(startDate);
        if (absStart && absStart < eventStart) {
            return `Early: Starts before official event start (${eventStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`;
        }
    }

    // 2. Check against previous day overflow
    const dayBlocked = blockedRanges[day.day_number] || [];
    for (const b of dayBlocked) {
        if (start < b.end) {
            return `Overlap: Previous day's session ends at ${b.end}`;
        }
    }

    // 3. Check against other slots in SAME day (chronologically)
    const otherSlots = day.slots.map((s, idx) => ({ ...s, idx }))
        .filter(s => s.idx !== slotIndex)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

    for (const other of otherSlots) {
        const otherIsCross = other.end_time < other.start_time;
        const otherEnd = otherIsCross ? "23:59" : other.end_time; 
        
        if (start < otherEnd && end > other.start_time) {
            if (start >= other.start_time && start < otherEnd) {
                 return `Conflict: Overlaps with '${other.label || 'another session'}'`;
            }
        }
    }

    return null;
  };

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

  const hasAnyConflict = days.some((day, dIdx) => 
    day.slots.some((_, sIdx) => getSlotConflict(dIdx, sIdx) !== null)
  );

  const handleSave = async () => {
    if (hasAnyConflict) {
        setError(t('organizer.scheduleEditor.resolveConflicts'));
        return;
    }
    setLoading(true);
    setError(null);

    try {
        // Sort slots chronologically before saving
        const sortedDays = days.map(day => ({
            ...day,
            slots: [...day.slots].sort((a, b) => a.start_time.localeCompare(b.start_time))
        }));

        await organizerService.updateEvent(eventId, { schedule_days: sortedDays });
        onSave(sortedDays);
    } catch (err: any) {
        setError(err.message || t('organizer.scheduleEditor.saveFailed'));
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
                <h3 className="text-sm font-bold text-zinc-900">{t('organizer.scheduleEditor.day')} {day.day_number}</h3>
                {day.date_label && <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{day.date_label}</p>}
              </div>
            </div>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleAddSlot(dIdx)}
                disabled={isDayPassed(day.day_number)}
                className="rounded-xl h-9 border-zinc-200 text-zinc-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-1.5" /> {t('organizer.scheduleEditor.addSlot')}
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Blocked Ranges inherited from previous day */}
            {blockedRanges[day.day_number]?.map((b, bIdx) => (
                <div 
                  key={`blocked-${bIdx}`} 
                  className="bg-zinc-50 border border-zinc-200 border-dashed rounded-2xl p-4 flex items-center justify-between opacity-80 shadow-inner group/blocked relative overflow-hidden"
                  title={t('organizer.scheduleEditor.blockedSlotTitle')}
                >
                    <div className="absolute inset-0 bg-zinc-100/30 -z-10 [background-image:linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.02)_25%,rgba(0,0,0,0.02)_50%,transparent_50%,transparent_75%,rgba(0,0,0,0.02)_75%,rgba(0,0,0,0.02))] [background-size:20px_20px]" />
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-zinc-200 shadow-sm">
                             <Clock className="w-3.5 h-3.5 text-zinc-400" />
                             <span className="text-xs font-black text-zinc-500 tabular-nums tracking-tight">{b.start} → {b.end}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-zinc-100 rounded-lg">
                                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                            </div>
                            <span className="text-sm font-bold text-zinc-500 italic max-w-xs truncate">{b.label}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-200/50 px-2 py-1 rounded-md border border-zinc-300/30">{t('organizer.scheduleEditor.autoBlocked')}</span>
                    </div>
                </div>
            ))}

            {day.slots.map((slot, sIdx) => {
              const isCrossDay = slot.end_time < slot.start_time;
              const conflict = getSlotConflict(dIdx, sIdx);
              const passed = isSlotPassed(day.day_number, slot.end_time);

              return (
                <div 
                  key={sIdx} 
                  className={`group relative bg-white border rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5 ${
                    conflict 
                      ? 'border-red-300 bg-red-50/10' 
                      : passed
                        ? 'opacity-40 grayscale-[0.5] border-zinc-100'
                        : isCrossDay 
                          ? 'border-amber-200 bg-amber-50/5' 
                          : 'border-zinc-100 hover:border-indigo-200'
                  }`}
                >
                  {conflict && (
                    <div className="absolute -top-3 left-4 px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-red-200 z-10 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <AlertCircle className="w-3 h-3" /> {conflict}
                    </div>
                  )}
                  {passed && !conflict && (
                    <div className="absolute -top-3 left-4 px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-md shadow-lg shadow-red-200 z-10 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <AlertCircle className="w-3 h-3" /> {t('organizer.scheduleEditor.passed')}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-y-6 gap-x-8 items-start">
                    {/* Time Range */}
                    <div className="lg:col-span-4 space-y-3 min-w-0">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3 h-3 text-indigo-500" /> {t('organizer.scheduleEditor.timeRange')}
                        </label>
                        {isCrossDay && (
                          <span 
                            className="p-1 bg-amber-100 text-amber-600 rounded-md cursor-help flex items-center gap-1 shadow-sm"
                            title={t('organizer.scheduleEditor.spillsNextDay')}
                          >
                            <ArrowRight className="w-2.5 h-2.5" />
                            <span className="text-[8px] font-black uppercase tracking-tighter">{t('organizer.scheduleEditor.nextDay')}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-1 min-w-0 group/input">
                           <input 
                            type="time" 
                            value={slot.start_time} 
                            disabled={passed}
                            onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'start_time', e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm font-bold text-zinc-700 tabular-nums focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all group-hover/input:border-zinc-300 disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                        <span className="text-zinc-300 font-bold shrink-0">→</span>
                        <div className="relative flex-1 min-w-0 group/input">
                          <input 
                            type="time" 
                            value={slot.end_time} 
                            disabled={passed}
                            onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'end_time', e.target.value)}
                            className={`w-full rounded-xl border px-3 py-2.5 text-sm font-bold tabular-nums focus:ring-4 outline-none transition-all group-hover/input:border-zinc-300 disabled:opacity-60 disabled:cursor-not-allowed ${isCrossDay ? 'bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-500/10 focus:border-amber-500' : 'bg-zinc-50/50 border-zinc-200 text-zinc-700 focus:ring-indigo-500/10 focus:border-indigo-500'}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Label / Description */}
                    <div className="md:col-span-2 lg:col-span-5 space-y-3 min-w-0">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Info className="w-3 h-3 text-indigo-500" /> {t('organizer.scheduleEditor.activityDescription')}
                      </label>
                      <input 
                        type="text" 
                        value={slot.label} 
                        disabled={passed}
                        onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'label', e.target.value)}
                        placeholder={t('organizer.scheduleEditor.activityPlaceholder')}
                        className="w-full h-[46px] rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2 text-sm font-bold text-zinc-800 placeholder:text-zinc-400 placeholder:font-normal focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all hover:border-zinc-300 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Conference Toggle */}
                    <div className="lg:col-span-3 space-y-3 pt-1 lg:pt-0 min-w-0">
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 shadow-sm">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <Video className={`w-3.5 h-3.5 ${slot.is_conference ? 'text-violet-500' : 'text-zinc-400'}`} /> Conf.
                          </label>
                          <div className="flex items-center gap-2.5">
                              <span className={`text-[10px] font-black uppercase tracking-tight ${slot.is_conference ? 'text-violet-600' : 'text-zinc-400'}`}>
                                  {slot.is_conference ? 'Live' : 'Off'}
                              </span>
                              <button 
                                  onClick={() => handleUpdateSlot(dIdx, sIdx, 'is_conference', !slot.is_conference)}
                                  disabled={passed}
                                  className={`w-9 h-5 rounded-full transition-all duration-300 relative shadow-inner disabled:opacity-30 disabled:cursor-not-allowed ${slot.is_conference ? 'bg-violet-600' : 'bg-zinc-300'}`}
                              >
                                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-300 ${slot.is_conference ? 'left-5' : 'left-1'}`} />
                              </button>
                          </div>
                      </div>

                      {slot.is_conference && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 p-4 bg-violet-50/50 rounded-2xl border border-violet-100 shadow-sm shadow-violet-100/50">
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-violet-500 uppercase tracking-widest">{t('organizer.scheduleEditor.partnerEnterprise')}</label>
                            <select 
                              value={slot.assigned_enterprise_id || ""} 
                              disabled={passed}
                              onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'assigned_enterprise_id', e.target.value)}
                              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-900 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all hover:border-violet-300 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="">{t('organizer.scheduleEditor.choosePartner')}</option>
                              {enterprises.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-violet-500 uppercase tracking-widest flex items-center gap-1">
                              <User className="w-2.5 h-2.5" /> Speaker Name
                            </label>
                            <input 
                              type="text" 
                              value={slot.speaker_name || ""} 
                              disabled={passed}
                              onChange={(e) => handleUpdateSlot(dIdx, sIdx, 'speaker_name', e.target.value)}
                              placeholder={t('organizer.scheduleEditor.overridesEnterprise')}
                              className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-900 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all hover:border-violet-300 placeholder:font-normal placeholder:text-violet-300 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`flex items-center justify-end mt-4 pt-4 border-t border-zinc-100 lg:border-t-0 lg:pt-0 lg:mt-0 lg:absolute lg:right-4 lg:top-4 transition-opacity ${passed ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button 
                      onClick={() => handleRemoveSlot(dIdx, sIdx)}
                      disabled={passed}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold uppercase disabled:opacity-0 disabled:cursor-not-allowed"
                      title={t('organizer.scheduleEditor.removeSlot')}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="lg:hidden">{t('organizer.scheduleEditor.removeSlot')}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {day.slots.length === 0 && (
              <div className="py-10 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl">
                <Clock className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">{t('organizer.scheduleEditor.emptyDay')}</p>
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
          {t('organizer.eventDetail.buttons.cancel')}
        </Button>
        <Button 
            onClick={handleSave} 
            isLoading={loading}
            disabled={loading || hasAnyConflict}
            className={`rounded-xl px-10 h-11 transition-all ${hasAnyConflict ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100'}`}
        >
          <Save className="w-4 h-4 mr-2" /> {hasAnyConflict ? t('organizer.scheduleEditor.invalidSchedule') : t('organizer.eventDetail.schedule.save')}
        </Button>
      </div>
    </div>
  );
}
