import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { 
  Calendar, MapPin, Trophy, CheckCircle, FileDown, ArrowRight, 
  Swords, Clock, Sparkles
} from 'lucide-react';

interface Event {
  _id: string;
  name: string;
  date: string;
  venue: string;
  description?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  eventYear: number;
  registrationDeadline?: string;
}

interface Registration {
  _id: string;
  regId?: string;
  userId: string;
  eventId: string;
  pdfUrl?: string;
  fullName: string;
}

export const Events: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEngagement('page_view_events', '/events', user?._id);

    const fetchData = async () => {
      try {
        const eventsRes = await fetch('/api/events');
        if (!eventsRes.ok) throw new Error('Failed to load events.');
        const eventsData: Event[] = await eventsRes.json();
        setEvents(eventsData);

        if (user) {
          const regsRes = await fetch('/api/registrations', {
            credentials: 'include'
          });
          if (regsRes.ok) {
            const regsData = await regsRes.json();
            setRegistrations(regsData);
          }
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading event data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleDownload = (pdfUrl: string, regId: string) => {
    trackEngagement('pdf_download_events', `/events/download/${regId}`);
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      window.open(`/api/registrations/${regId}/download`, '_blank');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Ongoing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
            <Clock className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5" />
            Upcoming
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-600">
        <Swords className="w-12 h-12 text-rose-500 animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Loading tournament catalog...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-rose-600 text-xs font-bold uppercase tracking-widest bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-100">
          Championship Tournament Hub
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-3 sm:text-4xl">
          National Taekwondo Tournaments
        </h1>
        <p className="mt-3 text-base text-slate-500">
          Browse sanctioned championship titles, review competition venues, and register athletes for official national tournaments.
        </p>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 rounded-r-lg text-sm font-medium mb-8">
          {error}
        </div>
      )}

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 max-w-2xl mx-auto shadow-sm">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No events scheduled</h3>
          <p className="text-sm text-slate-400 mt-1">Check back later or contact tournament administration.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => {
            const matchedReg = registrations.find((r) => r.eventId === event._id);
            const isRegistered = !!matchedReg;

            const deadlineDate = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
            const isDeadlinePassed = deadlineDate ? new Date() > deadlineDate : false;
            
            // Calculate remaining hours for urgency check (48 hours)
            let isUrgent = false;
            let urgencyText = "";
            if (deadlineDate && !isDeadlinePassed) {
              const diffMs = deadlineDate.getTime() - Date.now();
              const diffHours = diffMs / (1000 * 60 * 60);
              if (diffHours > 0 && diffHours <= 48) {
                isUrgent = true;
                if (diffHours < 24) {
                  const hours = Math.ceil(diffHours);
                  urgencyText = `Closes in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                } else {
                  const days = Math.ceil(diffHours / 24);
                  urgencyText = `Closes in ${days} ${days === 1 ? 'day' : 'days'}`;
                }
              }
            }

            return (
              <div
                key={event._id}
                className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Event Cover Accent */}
                <div className="h-2 bg-gradient-to-r from-rose-500 to-amber-500" />

                <div className="p-6 flex-grow flex flex-col justify-between">
                  <div>
                    {/* Badge & Year */}
                    <div className="flex items-center justify-between mb-4">
                      {getStatusBadge(event.status)}
                      <span className="text-xs font-bold text-slate-400">CY {event.eventYear}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-bold text-slate-900 leading-snug mb-2 hover:text-rose-500 transition-colors">
                      {event.name}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-slate-500 mb-6 line-clamp-3">
                      {event.description || 'Official Sparring & Poomsae divisions. Compete for national seeding points, titles, and recognition.'}
                    </p>

                    {/* Location & Date Details */}
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'long' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                      {event.registrationDeadline && (
                        <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-100">
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              Deadline: {new Date(event.registrationDeadline).toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}
                            </span>
                          </div>
                          {isUrgent && (
                            <div className="text-[10px] font-bold text-rose-500 animate-pulse bg-rose-50 py-1 px-2 rounded border border-rose-100 self-start mt-0.5">
                              ⏳ {urgencyText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Block: Register Competitor or Download Application Slip */}
                  <div className="pt-4 border-t border-slate-100 mt-auto space-y-2.5">
                    {isRegistered ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>Registered as {matchedReg.fullName}</span>
                        </div>

                        <button
                          onClick={() => handleDownload(matchedReg.pdfUrl || '', matchedReg._id)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                          <FileDown className="w-4 h-4 text-slate-500" />
                          Download Application Slip
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/events/${event._id}/register`)}
                        disabled={event.status === 'completed' || isDeadlinePassed}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent cursor-pointer shadow-sm"
                      >
                        <span>{isDeadlinePassed ? 'Registration Closed' : 'Register Competitor'}</span>
                        {!isDeadlinePassed && <ArrowRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
