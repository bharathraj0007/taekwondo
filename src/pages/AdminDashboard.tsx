import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { calculateAgeOnEvent } from '../utils/categories';
import { BracketVisualizer } from '../components/BracketVisualizer';
import { 
  Users, Swords, Trophy, BarChart3, Radio, FileText, CheckCircle, 
  Trash2, Plus, Minus, RefreshCw, Smartphone, Monitor, Compass, 
  Sparkles, Calendar, Award, Zap, HelpCircle, Activity, Search, Filter,
  Download, Edit, PlusCircle, Check, X, ShieldAlert, Image, MapPin, Tag, Users2, Mail, ArrowLeftRight, Eye, LayoutGrid, AlertCircle, AlertTriangle, ShieldCheck, KeyRound, UserPlus,
  BookOpen, ChevronDown, ChevronUp, Copy, Shield
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Tab State
  const validTabs = ['dashboard', 'events', 'registrations', 'coaches', 'referees', 'referee-management', 'categories', 'draws', 'live', 'gallery', 'smtp'];
  const initialTabParam = searchParams.get('tab') || location.state?.activeTab;
  const initialTab = initialTabParam === 'referee-management' ? 'referees' : initialTabParam;
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'registrations' | 'coaches' | 'referees' | 'categories' | 'draws' | 'live' | 'gallery' | 'smtp'>(
    initialTab && validTabs.includes(initialTab) ? (initialTab === 'referee-management' ? 'referees' : initialTab) : 'dashboard'
  );

  // Sync tab from query param when it changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as any;
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam === 'referee-management' ? 'referees' : tabParam);
    }
  }, [searchParams]);

  // Redirect non-admins
  useEffect(() => {
    trackEngagement('page_view_admin_dashboard', '/admin', user?._id);
    if (!isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, navigate]);

  // Backend state arrays
  const [events, setEvents] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);

  // Referee Staff Management state
  const [referees, setReferees] = useState<any[]>([]);
  const [refereeForm, setRefereeForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [creatingReferee, setCreatingReferee] = useState(false);
  const [refereeActionError, setRefereeActionError] = useState<string | null>(null);
  const [refereeActionSuccess, setRefereeActionSuccess] = useState<string | null>(null);
  const [resettingRefId, setResettingRefId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState<string>('');
  const [refereeSearch, setRefereeSearch] = useState<string>('');

  // Search & Filters state
  const [regSearch, setRegSearch] = useState('');
  const [regFilterEvent, setRegFilterEvent] = useState('');
  const [regFilterGender, setRegFilterGender] = useState('');
  const [regFilterCategory, setRegFilterCategory] = useState('');
  const [regFilterWeight, setRegFilterWeight] = useState('');
  const [regFilterCoach, setRegFilterCoach] = useState('');

  // Selected Player detail modal
  const [selectedRegDetail, setSelectedRegDetail] = useState<any | null>(null);
  const [isEditingReg, setIsEditingReg] = useState(false);
  const [deletingReg, setDeletingReg] = useState<any | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingRegForm, setEditingRegForm] = useState<any>({
    fullName: '',
    dob: '',
    gender: 'male',
    beltRank: '',
    coachName: '',
    aadharLastFour: '',
    weightCategory: '',
    status: 'pending'
  });

  // Event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [eventForm, setEventForm] = useState({
    name: '',
    date: '',
    venue: '',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed',
    eventYear: 2026,
    registrationDeadline: '',
    allowedCoachIds: [] as string[]
  });

  // Coach states for event scoping
  const [coachesList, setCoachesList] = useState<any[]>([]);
  const [coachSearchTerm, setCoachSearchTerm] = useState('');
  const [inlineCoachName, setInlineCoachName] = useState('');

  // Brackets selection state
  const [bracketGender, setBracketGender] = useState<'male' | 'female'>('male');
  const [bracketWeight, setBracketWeight] = useState('');
  const [bracketAgeCategory, setBracketAgeCategory] = useState('Senior');
  const [bracketError, setBracketError] = useState<string | null>(null);
  const [bracketSuccess, setBracketSuccess] = useState<string | null>(null);
  const [selectedDrawEvent, setSelectedDrawEvent] = useState('evt_autumn2026');
  const [drawStatus, setDrawStatus] = useState<'draft' | 'finalized'>('draft');
  const [allowPlaceholders, setAllowPlaceholders] = useState(true);
  const [targetBracketSize, setTargetBracketSize] = useState('auto');
  const [bracketViewMode, setBracketViewMode] = useState<'visualizer' | 'table'>('visualizer');
  const [catStats, setCatStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showDrawRules, setShowDrawRules] = useState(true);

  // Certificate standings management state
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [certActionLoading, setCertActionLoading] = useState(false);
  const [certMessage, setCertMessage] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);

  // Live Scorer State
  const [activeScoringMatch, setActiveScoringMatch] = useState<any | null>(null);
  const [scorerGenderFilter, setScorerGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [scorerWeightFilter, setScorerWeightFilter] = useState<string>('all');
  const [scorerAgeFilter, setScorerAgeFilter] = useState<string>('all');
  const [scorerEventFilter, setScorerEventFilter] = useState<string>('all');
  const [scorerStatusFilter, setScorerStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');

  // Gallery upload state
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SMTP Configuration State
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpHasPassword, setSmtpHasPassword] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [smtpSuccess, setSmtpSuccess] = useState<string | null>(null);
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpTestError, setSmtpTestError] = useState<string | null>(null);
  const [smtpTestSuccess, setSmtpTestSuccess] = useState<string | null>(null);

  const fetchSMTPSettings = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/auth/smtp', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSmtpHost(data.host || '');
        setSmtpPort(data.port || '587');
        setSmtpUser(data.user || '');
        setSmtpFrom(data.from || '');
        setSmtpHasPassword(data.hasPassword || false);
        setSmtpPass('');
      }
    } catch (err) {
      console.error('Failed to load SMTP config:', err);
    }
  };

  // Coach helper logic (State to store explicitly configured custom coaches)
  const [customCoaches, setCustomCoaches] = useState<string[]>([
    "Govind M",
    "R Krishnamurthy",
    "Satish R"
  ]);
  const [newCoachName, setNewCoachName] = useState('');
  const [isEditingCoachIdx, setIsEditingCoachIdx] = useState<number | null>(null);
  const [editingCoachVal, setEditingCoachVal] = useState('');

  // Dynamic categories management state
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const maleWeightDivisions = categories.find(c => c.name.toLowerCase() === bracketAgeCategory.toLowerCase())?.maleWeightClasses || [
    "U-18 kg", "U-21 kg", "U-23 kg", "U-25 kg", "U-27 kg", "U-29 kg", 
    "U-32 kg", "U-35 kg", "U-38 kg", "U-41 kg", "U-44 kg", "U-50 kg"
  ];

  const femaleWeightDivisions = categories.find(c => c.name.toLowerCase() === bracketAgeCategory.toLowerCase())?.femaleWeightClasses || [
    "U-16 kg", "U-18 kg", "U-20 kg", "U-22 kg", "U-24 kg", "U-26 kg", 
    "U-29 kg", "U-32 kg", "U-35 kg", "U-38 kg", "U-41 kg", "U-47 kg"
  ];

  const allWeightDivisions = [...maleWeightDivisions, ...femaleWeightDivisions];

  const ageCategories = ["Sub-Junior", "Cadet", "Junior", "Senior"];

  const beltRanks = [
    "white", "yellow stripe", "yellow", "green stripe", "green",
    "blue stripe", "blue", "red stripe", "red", "black"
  ];

  useEffect(() => {
    const divisions = bracketGender === 'male' ? maleWeightDivisions : femaleWeightDivisions;
    if (divisions && divisions.length > 0) {
      setBracketWeight(divisions[0]);
    }
  }, [bracketGender, bracketAgeCategory, categories]);

  const [categoryForm, setCategoryForm] = useState({
    _id: '',
    name: '',
    minAge: 8,
    maxAge: 32,
    maleWeightClassesText: '',
    femaleWeightClassesText: ''
  });
  const [selectedCategoryEvent, setSelectedCategoryEvent] = useState<string>('global');
  const [copyFromEventId, setCopyFromEventId] = useState<string>('global');
  const [showCopyCategoryModal, setShowCopyCategoryModal] = useState<boolean>(false);

  // Match editing management states
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchForm, setMatchForm] = useState({
    _id: '',
    player1Name: '',
    player2Name: '',
    player1Id: '',
    player2Id: '',
    round: '',
    status: 'upcoming',
    score1: 0,
    score2: 0,
    winnerId: ''
  });

  const handleSaveMatchEdit = async (e?: React.FormEvent, republishAfterSave: boolean = false) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/matches/${matchForm._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          player1Name: matchForm.player1Name,
          player2Name: matchForm.player2Name,
          player1Id: matchForm.player1Id,
          player2Id: matchForm.player2Id,
          round: matchForm.round,
          status: matchForm.status,
          score: {
            player1: parseInt(matchForm.score1 as any, 10) || 0,
            player2: parseInt(matchForm.score2 as any, 10) || 0
          },
          winnerId: matchForm.winnerId || undefined
        })
      });

      if (res.ok) {
        setShowMatchModal(false);
        if (republishAfterSave) {
          await handleRepublishDraw();
        } else {
          setBracketSuccess(`Draw changes for Match #${matchForm._id.slice(-6).toUpperCase()} saved successfully.`);
          refreshData();
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update match draw copy');
      }
    } catch (err) {
      console.error('Error saving match draw copy:', err);
    }
  };

  const handleOpenMatchEdit = (m: any) => {
    setEditingMatch(m);
    setMatchForm({
      _id: m._id,
      player1Name: m.player1Name,
      player2Name: m.player2Name,
      player1Id: m.player1Id || '',
      player2Id: m.player2Id || '',
      round: m.round,
      status: m.status,
      score1: m.score?.player1 ?? 0,
      score2: m.score?.player2 ?? 0,
      winnerId: m.winnerId || ''
    });
    setShowMatchModal(true);
  };

  const fetchDrawStatus = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`/api/draws/status?eventId=${selectedDrawEvent}&category=${bracketAgeCategory}&weightCategory=${encodeURIComponent(bracketWeight)}&gender=${bracketGender}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDrawStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to fetch draw status:', err);
    }
  };

  useEffect(() => {
    if (isAdmin && bracketWeight) {
      fetchDrawStatus();
    }
  }, [selectedDrawEvent, bracketAgeCategory, bracketWeight, bracketGender, isAdmin]);

  const fetchCategories = async (targetEvtId?: string) => {
    try {
      setLoadingCategories(true);
      const activeEvt = targetEvtId !== undefined ? targetEvtId : selectedCategoryEvent;
      const url = activeEvt && activeEvt !== 'global'
        ? `/api/categories?eventId=${activeEvt}`
        : '/api/categories';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const maleWeightClasses = categoryForm.maleWeightClassesText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const femaleWeightClasses = categoryForm.femaleWeightClassesText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        _id: categoryForm._id || undefined,
        name: categoryForm.name,
        minAge: parseInt(categoryForm.minAge as any, 10),
        maxAge: parseInt(categoryForm.maxAge as any, 10),
        maleWeightClasses,
        femaleWeightClasses,
        eventId: selectedCategoryEvent !== 'global' ? selectedCategoryEvent : undefined
      };

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Failed to save category');
        return;
      }

      setShowCategoryModal(false);
      fetchCategories();
      refreshData();
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const handleCloneCategories = async (sourceEvtId: string) => {
    if (!isAdmin || selectedCategoryEvent === 'global') return;
    try {
      setLoadingCategories(true);
      const res = await fetch('/api/categories/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetEventId: selectedCategoryEvent,
          sourceEventId: sourceEvtId === 'global' ? undefined : sourceEvtId
        })
      });

      if (res.ok) {
        setShowCopyCategoryModal(false);
        await fetchCategories(selectedCategoryEvent);
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to copy categories.');
      }
    } catch (err) {
      console.error('Error cloning categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to delete the "${catId}" category?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        fetchCategories();
        refreshData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete category');
      }
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const fetchCoaches = async () => {
    try {
      const res = await fetch('/api/coaches', { credentials: 'include' });
      if (res.ok) {
        setCoachesList(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch coaches:', err);
    }
  };

  // Global Sync Server Data
  const refreshData = async () => {
    if (!isAdmin) return;
    try {
      const [eventsRes, regRes, matchRes, analyticRes, galleryRes, catRes, coachesRes] = await Promise.all([
        fetch('/api/events', { credentials: 'include' }),
        fetch('/api/registrations', { credentials: 'include' }),
        fetch('/api/matches', { credentials: 'include' }),
        fetch('/api/analytics', { credentials: 'include' }),
        fetch('/api/gallery', { credentials: 'include' }),
        fetch('/api/categories', { credentials: 'include' }),
        fetch('/api/coaches', { credentials: 'include' })
      ]);

      if (eventsRes.ok) {
        const loadedEvents = await eventsRes.json();
        setEvents(loadedEvents);
        if (loadedEvents.length > 0 && selectedDrawEvent === 'evt_autumn2026') {
          // If default state hasn't changed, sync with the first active tournament event ID
          setSelectedDrawEvent(loadedEvents[0]._id);
        }
      }
      if (regRes.ok) setRegistrations(await regRes.json());
      if (matchRes.ok) setMatches(await matchRes.json());
      if (analyticRes.ok) setAnalyticsData(await analyticRes.json());
      if (galleryRes.ok) setGalleryImages(await galleryRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (coachesRes.ok) setCoachesList(await coachesRes.json());
      fetchReferees();

    } catch (err) {
      console.error('Failed to sync admin details:', err);
    }
  };

  const fetchReferees = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/referee/admin/list', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setReferees(data);
      }
    } catch (err) {
      console.error('Failed to fetch referee list:', err);
    }
  };

  const handleCreateReferee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setCreatingReferee(true);
    setRefereeActionError(null);
    setRefereeActionSuccess(null);

    try {
      const res = await fetch('/api/referee/admin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(refereeForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create referee account.');
      }

      setRefereeActionSuccess(`Referee official "${refereeForm.name}" was successfully registered!`);
      setRefereeForm({ name: '', email: '', password: '', phone: '' });
      fetchReferees();
    } catch (err: any) {
      setRefereeActionError(err.message || 'Error creating referee.');
    } finally {
      setCreatingReferee(false);
    }
  };

  const handleDeleteReferee = async (refId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete referee account for "${name}"? This action will revoke their officiating access.`)) return;
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/referee/admin/${refId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        setRefereeActionSuccess(`Referee "${name}" was deleted successfully.`);
        fetchReferees();
      } else {
        const data = await res.json();
        setRefereeActionError(data.error || 'Failed to delete referee account.');
      }
    } catch (err: any) {
      setRefereeActionError(err.message || 'Error deleting referee account.');
    }
  };

  const handleResetRefereePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !resettingRefId) return;

    try {
      const res = await fetch(`/api/referee/admin/${resettingRefId}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ newPassword: resetPasswordVal })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setRefereeActionSuccess('Referee passcode updated successfully!');
      setResettingRefId(null);
      setResetPasswordVal('');
    } catch (err: any) {
      setRefereeActionError(err.message || 'Error resetting password.');
    }
  };

  useEffect(() => {
    if (isAdmin) {
      refreshData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'categories' && isAdmin) {
      fetchCategories();
    }
    if (activeTab === 'referees' && isAdmin) {
      fetchReferees();
    }
    if (activeTab === 'smtp' && isAdmin) {
      fetchSMTPSettings();
    }
  }, [activeTab, isAdmin]);

  // Dynamic calculations for coach initials, counter mapping & disambiguation
  const getParsedCoaches = () => {
    // Collect all coach names (from explicit custom list plus actual registrations)
    const allUniqueCoachNames = Array.from(new Set([
      ...coachesList.map((c: any) => c.name),
      ...registrations.map(r => r.coachName || 'NA')
    ])).map(name => name.trim()).filter(Boolean);

    // Calculate details
    const coachesCalculated = allUniqueCoachNames.map(name => {
      const words = name.split(' ').filter(Boolean);
      let baseInitials = words.map((w: string) => w[0]?.toUpperCase()).filter(Boolean).join('');
      if (!baseInitials) baseInitials = 'NA';

      // Gather matching registrations
      const associatedPlayers = registrations.filter(r => (r.coachName || '').trim() === name);

      return {
        name,
        baseInitials,
        playerCount: associatedPlayers.length,
        players: associatedPlayers
      };
    });

    // Handle disambiguation conflicts deterministically
    const initialsGroups: Record<string, typeof coachesCalculated> = {};
    coachesCalculated.forEach(coach => {
      if (!initialsGroups[coach.baseInitials]) {
        initialsGroups[coach.baseInitials] = [];
      }
      initialsGroups[coach.baseInitials].push(coach);
    });

    const finalizedCoaches: any[] = [];
    Object.entries(initialsGroups).forEach(([base, group]) => {
      if (group.length <= 1) {
        finalizedCoaches.push({
          ...group[0],
          resolvedPrefix: base
        });
      } else {
        // Multiple coaches clash! Suffix GM1, GM2, GM3...
        group.forEach((coach, index) => {
          finalizedCoaches.push({
            ...coach,
            resolvedPrefix: `${base}${index + 1}`
          });
        });
      }
    });

    return finalizedCoaches;
  };

  const parsedCoachesList = getParsedCoaches();

  // Create or Update Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const url = editingEvent ? `/api/events/${editingEvent._id}` : '/api/events';
    const method = editingEvent ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(eventForm)
      });

      if (res.ok) {
        setShowEventModal(false);
        setEditingEvent(null);
        setEventForm({ name: '', date: '', venue: '', status: 'upcoming', eventYear: 2026, registrationDeadline: '', allowedCoachIds: [] });
        refreshData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to save event information.');
      }
    } catch (err) {
      console.error('Event save error:', err);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this event? This action is irreversible.')) return;
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        refreshData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete event.');
      }
    } catch (err) {
      console.error('Event delete error:', err);
    }
  };

  // Delete Registration trigger (opens modal)
  const handleDeleteRegistration = (regOrId: any) => {
    setActionFeedback(null);
    if (typeof regOrId === 'string') {
      const found = registrations.find(r => r._id === regOrId || r.regId === regOrId);
      if (found) {
        setDeletingReg(found);
      } else {
        setDeletingReg({ _id: regOrId, fullName: 'Selected Competitor' });
      }
    } else {
      setDeletingReg(regOrId);
    }
  };

  // Perform actual deletion
  const handleConfirmDeleteRegistration = async () => {
    if (!deletingReg || !isAdmin) return;
    setDeletingLoading(true);
    setActionFeedback(null);
    const id = deletingReg._id || deletingReg.regId;
    const name = deletingReg.fullName || id;

    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Remove the row from the UI immediately
        setRegistrations(prev => prev.filter(r => r._id !== id && r.regId !== id));
        if (selectedRegDetail?._id === id || selectedRegDetail?.regId === id) {
          setSelectedRegDetail(null);
        }
        setDeletingReg(null);
        setActionFeedback({
          type: 'success',
          message: `Competitor "${name}" (${id}) was successfully removed from tournament registry.`
        });
        refreshData();
        fetchCategoryStats();
      } else {
        setActionFeedback({
          type: 'error',
          message: data.error || 'Failed to delete competitor registration.'
        });
      }
    } catch (err: any) {
      console.error('Delete registration error:', err);
      setActionFeedback({
        type: 'error',
        message: err.message || 'Network error while deleting competitor.'
      });
    } finally {
      setDeletingLoading(false);
    }
  };

  // Edit Registration (Admin Save)
  const handleSaveRegEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedRegDetail) return;

    try {
      const res = await fetch(`/api/registrations/${selectedRegDetail._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(editingRegForm)
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedRegDetail(updated);
        setIsEditingReg(false);
        refreshData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to edit registration records');
      }
    } catch (err) {
      console.error('Registration put edit error:', err);
    }
  };

  // Fetch category verification statistics (registered vs bracket)
  const fetchCategoryStats = async () => {
    if (!bracketWeight || !bracketGender) return;
    setLoadingStats(true);
    try {
      const res = await fetch(
        `/api/matches/category-stats?eventId=${selectedDrawEvent}&category=${encodeURIComponent(bracketAgeCategory)}&gender=${bracketGender}&weightCategory=${encodeURIComponent(bracketWeight)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setCatStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch category stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Certificate standings management functions
  const fetchStandings = async () => {
    if (!isAdmin || !bracketWeight || !bracketGender) return;
    try {
      setLoadingStandings(true);
      const res = await fetch(
        `/api/certificates/status?eventId=${selectedDrawEvent}&category=${encodeURIComponent(bracketAgeCategory)}&weightCategory=${encodeURIComponent(bracketWeight)}&gender=${bracketGender}`,
        {
          credentials: 'include'
        }
      );
      if (res.ok) {
        const data = await res.json();
        setStandings(data);
      }
    } catch (err) {
      console.error('Failed to fetch category standings:', err);
    } finally {
      setLoadingStandings(false);
    }
  };

  const handleGenerateCertificates = async (forceResend = false) => {
    if (!isAdmin) return;
    setCertActionLoading(true);
    setCertMessage(null);
    setCertError(null);
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: selectedDrawEvent,
          category: bracketAgeCategory,
          weightCategory: bracketWeight,
          gender: bracketGender,
          forceResend
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCertMessage(data.message || 'Certificates successfully generated and dispatched!');
        fetchStandings();
      } else {
        setCertError(data.error || data.message || 'Failed to process certificates.');
      }
    } catch (err: any) {
      setCertError(err.message || String(err));
    } finally {
      setCertActionLoading(false);
    }
  };

  const handleResendSingleCertificate = async (standingId: string) => {
    if (!isAdmin) return;
    setCertActionLoading(true);
    setCertMessage(null);
    setCertError(null);
    try {
      const res = await fetch(`/api/certificates/resend/${standingId}`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCertMessage(data.message || 'Certificate resent successfully!');
        fetchStandings();
      } else {
        setCertError(data.error || 'Failed to resend certificate.');
      }
    } catch (err: any) {
      setCertError(err.message || String(err));
    } finally {
      setCertActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'draws' || isAdmin) {
      fetchCategoryStats();
      fetchStandings();
    }
  }, [selectedDrawEvent, bracketAgeCategory, bracketGender, bracketWeight, matches.length, registrations.length, activeTab]);

  // Bracket generator trigger
  const handleGenerateBracket = async () => {
    setBracketError(null);
    setBracketSuccess(null);
    if (!isAdmin) return;

    try {
      const res = await fetch('/api/matches/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          weightCategory: bracketWeight,
          gender: bracketGender,
          ageCategory: bracketAgeCategory,
          eventId: selectedDrawEvent,
          allowPlaceholders,
          bracketSize: targetBracketSize === 'auto' ? undefined : parseInt(targetBracketSize, 10)
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        data = { error: txt || 'Server returned an invalid response' };
      }

      if (res.ok) {
        setBracketSuccess(data.message || 'Brackets generated successfully!');
        refreshData();
        fetchCategoryStats();
      } else {
        setBracketError(data.error || 'Failed to generate bracket pairing.');
      }
    } catch (err) {
      setBracketError('Network error during bracket generation.');
      console.error('Bracket generation error:', err);
    }
  };

  const handleFinalizeDraw = async () => {
    setBracketError(null);
    setBracketSuccess(null);
    if (!isAdmin) return;

    // Safeguard check before finalizing
    if (catStats && catStats.missingAthletes && catStats.missingAthletes.length > 0) {
      const missingNames = catStats.missingAthletes.map((a: any) => a.fullName).join(', ');
      setBracketError(`Cannot finalize: ${catStats.missingAthletes.length} registered player(s) are missing from the bracket (${missingNames}). Please click "Generate Seeding Bracket Draw" to rebuild the draw with all competitors.`);
      return;
    }

    try {
      const res = await fetch('/api/draws/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: selectedDrawEvent,
          category: bracketAgeCategory,
          weightCategory: bracketWeight,
          gender: bracketGender
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        data = { error: txt || 'Server returned an invalid response' };
      }

      if (res.ok) {
        setBracketSuccess(data.message || 'Bracket Draw finalized and published successfully!');
        setDrawStatus('finalized');
        fetchCategoryStats();
      } else {
        setBracketError(data.error || 'Failed to finalize draw.');
      }
    } catch (err) {
      console.error('Finalize error:', err);
      setBracketError('Network error while finalizing bracket draw.');
    }
  };

  const handleUnlockDraw = async () => {
    setBracketError(null);
    setBracketSuccess(null);
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to unlock this draw? Unlocking will allow modifications to matchups and participant seeding.')) return;
    try {
      const res = await fetch('/api/draws/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: selectedDrawEvent,
          category: bracketAgeCategory,
          weightCategory: bracketWeight,
          gender: bracketGender
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        data = { error: txt || 'Server returned an invalid response' };
      }

      if (res.ok) {
        setBracketSuccess(data.message || 'Bracket Draw unlocked and set to draft.');
        setDrawStatus('draft');
        fetchCategoryStats();
      } else {
        setBracketError(data.error || 'Failed to unlock draw.');
      }
    } catch (err) {
      console.error('Unlock error:', err);
      setBracketError('Network error while unlocking bracket draw.');
    }
  };

  const handleRepublishDraw = async () => {
    setBracketError(null);
    setBracketSuccess(null);
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/draws/republish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventId: selectedDrawEvent,
          category: bracketAgeCategory,
          weightCategory: bracketWeight,
          gender: bracketGender
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const txt = await res.text();
        data = { error: txt || 'Server returned an invalid response' };
      }

      if (res.ok) {
        setBracketSuccess(data.message || 'Bracket Draw republished successfully! Updated bracket pairings are now live.');
        setDrawStatus('finalized');
        refreshData();
      } else {
        setBracketError(data.error || 'Failed to republish tournament draw.');
      }
    } catch (err) {
      console.error('Republish draw error:', err);
      setBracketError('Network error while republishing bracket draw.');
    }
  };

  const handleSwapCorners = async (match: any) => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`/api/matches/${match._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          player1Name: match.player2Name,
          player2Name: match.player1Name,
          player1Id: match.player2Id,
          player2Id: match.player1Id,
          score: {
            player1: match.score?.player2 || 0,
            player2: match.score?.player1 || 0
          }
        })
      });

      if (res.ok) {
        setBracketSuccess(`Corners swapped for Match #${match._id.slice(-6).toUpperCase()}!`);
        refreshData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to swap corners');
      }
    } catch (err) {
      console.error('Error swapping corners:', err);
    }
  };

  // Match scores live controller
  const updateMatchScore = async (matchId: string, playerKey: 'player1' | 'player2', increment: number) => {
    if (!isAdmin) return;

    const match = matches.find(m => m._id === matchId);
    if (!match) return;

    const currentScore = { ...match.score };
    currentScore[playerKey] = Math.max(0, currentScore[playerKey] + increment);

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ score: currentScore })
      });

      if (res.ok) {
        const data = await res.json();
        setMatches(prev => prev.map(m => m._id === matchId ? data.match : m));
        if (activeScoringMatch?._id === matchId) {
          setActiveScoringMatch(data.match);
        }
      }
    } catch (err) {
      console.error('Failed to update scores:', err);
    }
  };

  // Match status updater
  const updateMatchStatus = async (matchId: string, status: 'pending' | 'live' | 'completed') => {
    if (!isAdmin) return;

    const match = matches.find(m => m._id === matchId);
    if (!match) return;

    const body: any = { status };
    if (status === 'completed') {
      const winnerId = match.score.player1 > match.score.player2 ? match.player1Id : match.player2Id;
      body.winnerId = winnerId;
    } else if (status === 'live' || status === 'pending') {
      body.winnerId = null;
    }

    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setMatches(prev => prev.map(m => m._id === matchId ? data.match : m));
        if (activeScoringMatch?._id === matchId) {
          setActiveScoringMatch(data.match);
        }
        refreshData();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // RESET ALL MATCH RECORDS
  const handleResetAllMatches = async () => {
    if (!window.confirm('CRITICAL: This will wipe out all tournament fight records, completed scores, and knockout draw pairings. Are you sure you want to reset all match brackets?')) return;
    if (!isAdmin) return;

    try {
      const res = await fetch('/api/matches/clear-all', {
        method: 'POST',
        credentials: 'include'
      });

      if (res.ok) {
        alert('All match brackets reset successfully.');
        refreshData();
      }
    } catch (err) {
      console.error('Failed to reset matches:', err);
    }
  };

  // Add Custom Coach Name
  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoachName.trim()) return;
    if (coachesList.some(c => c.name.toLowerCase() === newCoachName.trim().toLowerCase())) {
      alert('Coach already in system list!');
      return;
    }
    try {
      const res = await fetch('/api/coaches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: newCoachName.trim() })
      });
      if (res.ok) {
        setNewCoachName('');
        fetchCoaches();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add coach');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Coach Record
  const handleUpdateCoach = async (index: number) => {
    if (!editingCoachVal.trim()) return;
    const coach = coachesList[index];
    if (!coach) return;
    
    if (coachesList.some((c, idx) => idx !== index && c.name.toLowerCase() === editingCoachVal.trim().toLowerCase())) {
      alert('A coach with this name already exists.');
      return;
    }

    try {
      const res = await fetch(`/api/coaches/${coach._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: editingCoachVal.trim() })
      });
      if (res.ok) {
        setIsEditingCoachIdx(null);
        fetchCoaches();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update coach');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Coach reference
  const handleDeleteCoach = async (coachInput: any) => {
    const coachName = typeof coachInput === 'string' ? coachInput : (coachInput?.name || '');
    const coachObj = coachesList.find(c => c.name.toLowerCase() === coachName.toLowerCase());
    const coachId = coachObj ? coachObj._id : null;

    if (registrations.some(r => r.coachName === coachName)) {
      alert('Cannot delete this coach. Some players are registered under this coach. Please edit those players first.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove "${coachName}" from the coaches roster?`)) return;
    
    if (!coachId) {
      alert('Coach record not found in persistent store.');
      return;
    }

    try {
      const res = await fetch(`/api/coaches/${coachId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchCoaches();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete coach');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save SMTP settings to backend
  const handleSaveSMTPSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSmtpLoading(true);
    setSmtpError(null);
    setSmtpSuccess(null);

    try {
      const res = await fetch('/api/auth/smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSmtpSuccess('SMTP configuration saved successfully and transporter reloaded!');
        setSmtpHasPassword(data.smtp.hasPassword);
        setSmtpPass('');
      } else {
        setSmtpError(data.error || 'Failed to save SMTP configuration settings.');
      }
    } catch (err: any) {
      setSmtpError('Network error while saving SMTP settings.');
    } finally {
      setSmtpLoading(false);
    }
  };

  // Trigger verification test email send
  const handleTestSMTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!smtpTestEmail.trim()) {
      setSmtpTestError('Test destination email address is required.');
      return;
    }

    setSmtpTestLoading(true);
    setSmtpTestError(null);
    setSmtpTestSuccess(null);

    try {
      const res = await fetch('/api/auth/smtp/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ testEmail: smtpTestEmail })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.wasFallback && data.warning) {
          setSmtpTestSuccess(`${data.message} ${data.warning}${data.previewUrl ? ` Test Mailbox Preview Link: ${data.previewUrl}` : ''}`);
        } else {
          setSmtpTestSuccess(data.message || 'Verification test email sent successfully!');
        }
      } else {
        setSmtpTestError(data.error || 'Failed to send verification test email.');
      }
    } catch (err: any) {
      setSmtpTestError('Network error while attempting to send test email.');
    } finally {
      setSmtpTestLoading(false);
    }
  };

  // Photo uploading handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !isAdmin) {
      setUploadError('Please select a valid image file first.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('caption', caption);

    try {
      const res = await fetch('/api/gallery/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload error');

      setUploadSuccess('Event photo uploaded successfully!');
      setCaption('');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refreshData();
    } catch (err: any) {
      setUploadError(err.message || 'Server error occurred during photo uploading.');
    } finally {
      setUploading(false);
    }
  };

  // Delete Image
  const handleDeleteImage = async (imageId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo from the public event gallery?')) return;
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/gallery/${imageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        refreshData();
      }
    } catch (err) {
      console.error('Delete image error:', err);
    }
  };

  // CSV Export utility
  const handleExportCSV = () => {
    const headers = ['Registration ID', 'Full Name', 'DOB', 'Gender', 'Age Category', 'Weight Class', 'Belt Rank', 'Coach/Academy', 'Aadhar Last 4', 'Status', 'Registered At'];
    
    const rows = filteredRegistrations.map(r => [
      r._id,
      r.fullName,
      r.dob,
      r.gender,
      r.ageCategory || 'Unclassified',
      r.weightCategory,
      r.beltRank,
      r.coachName || r.clubName || 'None',
      r.aadharLastFour || 'None',
      r.status,
      r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Taekwondo_Registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter registrations pool
  const filteredRegistrations = registrations.filter(r => {
    const matchSearch = regSearch ? r.fullName.toLowerCase().includes(regSearch.toLowerCase()) || r._id.toLowerCase().includes(regSearch.toLowerCase()) : true;
    const matchGender = regFilterGender ? r.gender === regFilterGender : true;
    const matchCategory = regFilterCategory ? r.ageCategory === regFilterCategory : true;
    const matchWeight = regFilterWeight ? r.weightCategory.toLowerCase().includes(regFilterWeight.toLowerCase()) : true;
    const matchCoach = regFilterCoach ? (r.coachName || '').toLowerCase() === regFilterCoach.toLowerCase() : true;
    return matchSearch && matchGender && matchCategory && matchWeight && matchCoach;
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Dynamic top operational header */}
      <div className="bg-slate-950 text-white py-8 px-6 border-b border-red-500/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-red-600/20 text-red-500 border border-red-500/30 text-[10px] font-mono font-bold tracking-widest px-3 py-1 rounded-full uppercase mb-2 animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>STAFF PORTAL SECURE ENVIRONMENT</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Taekwondo Championship <span className="text-red-500">Admin Control</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Central command console for real-time referee scoring, bracket drawing, active registration validation, event parameters control, and public broadcasting feeds.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={refreshData}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-200 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 active:scale-98 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow text-red-500" />
              <span>Sync All Data</span>
            </button>
            <button
              onClick={handleResetAllMatches}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-400 bg-red-950/40 border border-red-900/30 rounded-lg hover:bg-red-950/60 active:scale-98 transition-all cursor-pointer"
            >
              <span>Wipe Match Draw Roster</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main admin wrapper layout */}
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex-grow flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar Options */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 font-mono">Operations Menu</p>
          {[
            { id: 'dashboard', label: 'Dashboard Overview', icon: BarChart3, count: null },
            { id: 'events', label: 'Events Configuration', icon: Calendar, count: events.length },
            { id: 'registrations', label: 'Competitor Pool', icon: Users, count: registrations.length },
            { id: 'coaches', label: 'Coach Roster Tracker', icon: Users2, count: parsedCoachesList.length },
            { id: 'referees', label: 'Referee Management', icon: ShieldCheck, count: referees.length },
            { id: 'categories', label: 'Weight Divisions', icon: Tag, count: allWeightDivisions.length },
            { id: 'draws', label: 'Knockout Draws Copy', icon: Trophy, count: null },
            { id: 'live', label: 'Referee Scorer Pad', icon: Radio, count: matches.filter(m => m.status === 'live').length },
            { id: 'gallery', label: 'Broadcast Gallery', icon: Image, count: galleryImages.length },
            { id: 'smtp', label: 'SMTP Mailer Settings', icon: Mail, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  isSelected 
                    ? 'bg-slate-900 text-white shadow-md border-l-4 border-red-500' 
                    : 'bg-white text-slate-600 border border-slate-200/60 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-red-500' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== null && (
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
          
          <button
            onClick={() => navigate('/admin/status')}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 mt-4"
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
              <span>System Health Guard</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400"></span>
          </button>
        </div>

        {/* Content Panel Area */}
        <div className="flex-grow min-w-0">
          
          {/* Active Tab Router Logic */}

          {/* 1. Dashboard Overview */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              {/* Counter Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: 'Total Registered Players', val: registrations.length, desc: 'Approved & Pending athlete profiles', icon: Users, color: 'text-emerald-500 bg-emerald-50 border-emerald-100' },
                  { title: 'Registered Coaches', val: parsedCoachesList.length, desc: 'Active initials prefixes tracking', icon: Users2, color: 'text-indigo-500 bg-indigo-50 border-indigo-100' },
                  { title: 'Knockout Match Pairings', val: matches.length, desc: 'Live & Completed tournament draws', icon: Swords, color: 'text-red-500 bg-red-50 border-red-100' },
                  { title: 'Event Venues Configured', val: events.length, desc: 'Dynamic scheduling items', icon: Calendar, color: 'text-amber-500 bg-amber-50 border-amber-100' }
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight max-w-[140px]">{stat.title}</span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${stat.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <p className="text-3xl font-black text-slate-900 font-mono tracking-tight">{stat.val}</p>
                        <p className="text-[9px] text-slate-400 mt-1 leading-tight">{stat.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Category-wise Registrations Grid & Actions */}
              <div className="grid lg:grid-cols-3 gap-8">
                
                {/* Age distribution breakdown */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-3 uppercase tracking-wider font-mono">Athlete Age Classification Overview</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {ageCategories.map((cat, idx) => {
                      const count = registrations.filter(r => r.ageCategory === cat).length;
                      const maleCount = registrations.filter(r => r.ageCategory === cat && r.gender === 'male').length;
                      const femaleCount = registrations.filter(r => r.ageCategory === cat && r.gender === 'female').length;
                      const percentage = registrations.length ? Math.round((count / registrations.length) * 100) : 0;

                      return (
                        <div key={idx} className="bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                            <span>{cat} Class</span>
                            <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-[10px]">{count} ({percentage}%)</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span className="text-blue-600 font-bold">Male: {maleCount}</span>
                            <span className="text-pink-500 font-bold">Female: {femaleCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick actions panel */}
                <div className="bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest font-mono mb-2">Staff Quick Actions</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Utilize these rapid navigation hotlinks to manage schedules, generate randomized brackets, and update match progress.
                    </p>
                  </div>
                  <div className="space-y-2 mt-6">
                    <button 
                      onClick={() => setActiveTab('events')}
                      className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-200 transition-colors text-left px-4 flex items-center gap-2"
                    >
                      <Calendar className="w-3.5 h-3.5 text-red-500" />
                      <span>Manage Events & Dates</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('draws')}
                      className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-200 transition-colors text-left px-4 flex items-center gap-2"
                    >
                      <Trophy className="w-3.5 h-3.5 text-red-500" />
                      <span>Auto-Generate Brackets</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('live')}
                      className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-200 transition-colors text-left px-4 flex items-center gap-2"
                    >
                      <Radio className="w-3.5 h-3.5 text-red-500" />
                      <span>Scoring Desk Terminal</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Display recent analytics log feed if available */}
              {analyticsData && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">Live System Operations Activity Feed</h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto text-xs font-mono max-h-60 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[9px] uppercase tracking-wider font-bold">
                          <th className="p-2">Timestamp</th>
                          <th className="p-2">Client Details</th>
                          <th className="p-2">Event Operation Type</th>
                          <th className="p-2">Trigger Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analyticsData.recentActivity.slice(0, 8).map((log: any) => (
                          <tr key={log._id} className="hover:bg-slate-50/50">
                            <td className="p-2 text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</td>
                            <td className="p-2 font-bold text-slate-700 truncate max-w-[180px]">{log.userName}</td>
                            <td className="p-2 text-red-600 font-bold">{log.action}</td>
                            <td className="p-2 text-slate-500 font-mono">{log.page}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Events Management */}
          {activeTab === 'events' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">Tournament Events Roster</h3>
                    <p className="text-xs text-slate-400 mt-1">Configure event metadata, date parameters, and overall tournament years which feed the age cutoff algorithms.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingEvent(null);
                      setEventForm({ name: '', date: '', venue: '', status: 'upcoming', eventYear: 2026, registrationDeadline: '', allowedCoachIds: [] });
                      setShowEventModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Create Event</span>
                  </button>
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                        <th className="py-3 px-6">Event Details</th>
                        <th className="py-3 px-6">Event Year</th>
                        <th className="py-3 px-6">Venue & Location</th>
                        <th className="py-3 px-6">Broadcasting Status</th>
                        <th className="py-3 px-6">Coach Scoping</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {events.map((evt) => (
                        <tr key={evt._id} className="hover:bg-slate-50/50">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-800">{evt.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{evt.date}</div>
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-bold font-mono">{evt.eventYear}</td>
                          <td className="py-4 px-6 text-slate-500 font-medium">{evt.venue}</td>
                          <td className="py-4 px-6">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              evt.status === 'ongoing' ? 'bg-red-50 text-red-600 border border-red-200' :
                              evt.status === 'completed' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                              'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>
                              {evt.status}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {evt.allowedCoachIds && evt.allowedCoachIds.length > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                🎯 {evt.allowedCoachIds.length} Coach{evt.allowedCoachIds.length > 1 ? 'es' : ''} Scoped
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Legacy event created without explicit allowedCoachIds. Defaulting to full global roster. Edit event to restrict.">
                                ⚠️ All Coaches (Legacy / Unscoped)
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right space-x-1">
                            <button
                              onClick={() => {
                                setEditingEvent(evt);
                                setEventForm({
                                  name: evt.name,
                                  date: evt.date,
                                  venue: evt.venue,
                                  status: evt.status,
                                  eventYear: evt.eventYear || 2026,
                                  registrationDeadline: evt.registrationDeadline || '',
                                  allowedCoachIds: evt.allowedCoachIds || []
                                });
                                setShowEventModal(true);
                              }}
                              className="p-1.5 text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg cursor-pointer"
                              title="Edit Event"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(evt._id)}
                              className="p-1.5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Event edit modal */}
              {showEventModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-scale-up space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                        {editingEvent ? 'Edit Championship Event Details' : 'Create New Championship Event'}
                      </h3>
                      <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveEvent} className="space-y-4 text-xs font-sans">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 uppercase">Championship Event Name</label>
                        <input
                          type="text"
                          required
                          value={eventForm.name}
                          onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-250 rounded-lg bg-slate-50 focus:bg-white text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block font-bold text-slate-700 uppercase">Date/Duration String</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. October 14-16, 2026"
                            value={eventForm.date}
                            onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-250 rounded-lg bg-slate-50 focus:bg-white text-slate-800"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block font-bold text-slate-700 uppercase">Championship Year</label>
                          <input
                            type="number"
                            required
                            value={eventForm.eventYear}
                            onChange={(e) => setEventForm({ ...eventForm, eventYear: parseInt(e.target.value, 10) || 2026 })}
                            className="w-full px-3 py-2 border border-slate-250 rounded-lg bg-slate-50 focus:bg-white font-mono text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 uppercase">Venue & Address</label>
                        <input
                          type="text"
                          required
                          value={eventForm.venue}
                          onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-250 rounded-lg bg-slate-50 focus:bg-white text-slate-800"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 uppercase">Registration Deadline</label>
                        <input
                          type="datetime-local"
                          value={eventForm.registrationDeadline ? eventForm.registrationDeadline.substring(0, 16) : ''}
                          onChange={(e) => setEventForm({ ...eventForm, registrationDeadline: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                          className="w-full px-3 py-2 border border-slate-250 rounded-lg bg-slate-50 focus:bg-white text-slate-800 font-mono"
                        />
                      </div>

                      {/* Coach Selection Step */}
                      <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="block font-bold text-slate-700 uppercase text-xs">Event-Scoped Coach Selector</label>
                        <p className="text-[10px] text-slate-400">Select which coaches are allowed for this tournament registration form. If none are selected, all global coaches will be displayed by default.</p>
                        
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Search coach roster..."
                            onChange={(e) => setCoachSearchTerm(e.target.value)}
                            value={coachSearchTerm}
                            className="flex-grow px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = coachesList.map(c => c._id);
                              setEventForm(prev => ({ ...prev, allowedCoachIds: allIds }));
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 rounded-lg"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEventForm(prev => ({ ...prev, allowedCoachIds: [] }));
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 rounded-lg"
                          >
                            Clear All
                          </button>
                        </div>

                        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
                          {coachesList
                            .filter(c => c.name.toLowerCase().includes(coachSearchTerm.toLowerCase()))
                            .map((coach) => {
                              const isChecked = (eventForm.allowedCoachIds || []).includes(coach._id);
                              return (
                                <label key={coach._id} className="flex items-center gap-2.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const current = eventForm.allowedCoachIds || [];
                                      const updated = e.target.checked
                                        ? [...current, coach._id]
                                        : current.filter(id => id !== coach._id);
                                      setEventForm(prev => ({ ...prev, allowedCoachIds: updated }));
                                    }}
                                    className="h-3.5 w-3.5 text-rose-600 border-slate-350 rounded focus:ring-rose-500 cursor-pointer"
                                  />
                                  <span className="text-slate-700 text-xs font-semibold">{coach.name}</span>
                                </label>
                              );
                            })}
                          {coachesList.filter(c => c.name.toLowerCase().includes(coachSearchTerm.toLowerCase())).length === 0 && (
                            <p className="text-xs text-slate-400 italic">No matching coaches found in database.</p>
                          )}
                        </div>

                        <div className="flex gap-2 items-center bg-slate-100 p-2 rounded-lg border border-slate-200 mt-2">
                          <input
                            type="text"
                            placeholder="Register brand-new coach inline..."
                            value={inlineCoachName}
                            onChange={(e) => setInlineCoachName(e.target.value)}
                            className="flex-grow px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!inlineCoachName.trim()) return;
                              const normName = inlineCoachName.trim();
                              
                              const dup = coachesList.find(c => c.name.toLowerCase() === normName.toLowerCase());
                              if (dup) {
                                const current = eventForm.allowedCoachIds || [];
                                if (!current.includes(dup._id)) {
                                  setEventForm(prev => ({ ...prev, allowedCoachIds: [...current, dup._id] }));
                                }
                                setInlineCoachName('');
                                return;
                              }

                              try {
                                const res = await fetch('/api/coaches', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ name: normName })
                                });
                                if (res.ok) {
                                  const newCoach = await res.json();
                                  setCoachesList(prev => [...prev, newCoach]);
                                  setEventForm(prev => ({
                                    ...prev,
                                    allowedCoachIds: [...(prev.allowedCoachIds || []), newCoach._id]
                                  }));
                                  setInlineCoachName('');
                                } else {
                                  const data = await res.json();
                                  alert(data.error || 'Failed to add coach');
                                }
                              } catch (err) {
                                console.error('Inline coach error:', err);
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-900 text-white font-bold rounded text-xs hover:bg-slate-800 cursor-pointer"
                          >
                            Add Inline
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 uppercase">Operational Status</label>
                        <select
                          value={eventForm.status}
                          onChange={(e) => setEventForm({ ...eventForm, status: e.target.value as any })}
                          className="w-full px-3 py-2 border border-slate-250 rounded-lg bg-slate-50 text-slate-800 cursor-pointer"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="ongoing">Ongoing</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>

                      <div className="flex gap-2.5 pt-4 border-t border-slate-100 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowEventModal(false)}
                          className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Registrations Management */}
          {activeTab === 'registrations' && (
            <div className="space-y-4 animate-fade-in">
              {/* Action Feedback Banner */}
              {actionFeedback && (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {actionFeedback.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{actionFeedback.message}</span>
                  </div>
                  <button
                    onClick={() => setActionFeedback(null)}
                    className="p-1 hover:bg-black/5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                
                {/* Search & Filters */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">Athlete Registrations Pool ({filteredRegistrations.length} Entries)</h3>
                    <button
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 transition-all rounded-lg shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Export CSV spreadsheet</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search Name or ID..."
                        value={regSearch}
                        onChange={(e) => setRegSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white text-slate-800 text-xs"
                      />
                    </div>

                    <select
                      value={regFilterGender}
                      onChange={(e) => setRegFilterGender(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-2 bg-slate-50/50 text-xs text-slate-700 cursor-pointer"
                    >
                      <option value="">All Genders</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>

                    <select
                      value={regFilterCategory}
                      onChange={(e) => setRegFilterCategory(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-2 bg-slate-50/50 text-xs text-slate-700 cursor-pointer"
                    >
                      <option value="">All Age Categories</option>
                      {ageCategories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>

                    <select
                      value={regFilterCoach}
                      onChange={(e) => setRegFilterCoach(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-2 bg-slate-50/50 text-xs text-slate-700 cursor-pointer"
                    >
                      <option value="">All Coaches</option>
                      {parsedCoachesList.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                        <th className="py-3 px-4">Profile Details</th>
                        <th className="py-3 px-4">Registration ID</th>
                        <th className="py-3 px-4">D.O.B / Age Class</th>
                        <th className="py-3 px-4">Gender</th>
                        <th className="py-3 px-4">Coach / Academy</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredRegistrations.map((reg) => (
                        <tr key={reg._id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => {
                                setSelectedRegDetail(reg);
                                setEditingRegForm({
                                  fullName: reg.fullName,
                                  dob: reg.dob,
                                  gender: reg.gender,
                                  beltRank: reg.beltRank,
                                  coachName: reg.coachName || '',
                                  aadharLastFour: reg.aadharLastFour || '',
                                  weightCategory: reg.weightCategory,
                                  status: reg.status || 'pending'
                                });
                                setIsEditingReg(false);
                              }}
                              className="font-bold text-slate-800 text-left hover:text-red-600 hover:underline cursor-pointer"
                            >
                              {reg.fullName}
                            </button>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">
                              {reg.beltRank} · {reg.weightCategory}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono font-black text-[10px] uppercase shadow-sm">
                              {reg._id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-mono">
                            <div>{reg.dob}</div>
                            <div className="text-[9px] text-slate-400 font-sans font-bold uppercase mt-0.5">{reg.ageCategory || 'Unclassified'}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              reg.gender === 'male' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-pink-50 text-pink-600 border border-pink-100'
                            }`}>
                              {reg.gender}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-semibold">{reg.coachName || 'Not Available'}</td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              reg.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                              reg.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-200' :
                              'bg-amber-50 text-amber-600 border border-amber-200'
                            }`}>
                              {reg.status || 'pending'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              onClick={() => {
                                setSelectedRegDetail(reg);
                                setEditingRegForm({
                                  fullName: reg.fullName,
                                  dob: reg.dob,
                                  gender: reg.gender,
                                  beltRank: reg.beltRank,
                                  coachName: reg.coachName || '',
                                  aadharLastFour: reg.aadharLastFour || '',
                                  weightCategory: reg.weightCategory,
                                  status: reg.status || 'pending'
                                });
                                setIsEditingReg(true);
                              }}
                              className="p-1.5 text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-lg cursor-pointer inline-block"
                              title="Edit Athlete Profile"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteRegistration(reg._id)}
                              className="p-1.5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer inline-block"
                              title="Delete/Void Entry"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredRegistrations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider">No matching athlete registrations found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Player Detail & Edit Modal */}
              {selectedRegDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-scale-up space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                        {isEditingReg ? 'Edit Competitor Record' : 'Competitor Official Receipt Details'}
                      </h3>
                      <button onClick={() => setSelectedRegDetail(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {!isEditingReg ? (
                      <div className="space-y-4 text-xs font-mono">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 font-sans">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest font-mono">Registration ID</span>
                            <span className="font-mono font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs select-all">
                              {selectedRegDetail._id}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Competitor Full Name</span>
                            <span className="text-sm font-extrabold text-slate-900">{selectedRegDetail.fullName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Birthdate</span>
                              <span className="font-semibold text-slate-800">{selectedRegDetail.dob}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Age Classification</span>
                              <span className="font-extrabold text-red-600 uppercase text-[11px]">{selectedRegDetail.ageCategory || 'Unclassified'}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Belt Rank</span>
                              <span className="font-semibold text-slate-800 uppercase">{selectedRegDetail.beltRank}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Weight Division</span>
                              <span className="font-semibold text-slate-800">{selectedRegDetail.weightCategory}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Coach/Academy</span>
                              <span className="font-semibold text-slate-850">{selectedRegDetail.coachName || 'None'}</span>
                            </div>
                            <div>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Aadhar (Last 4)</span>
                              <span className="font-semibold text-slate-850 font-mono">{selectedRegDetail.aadharLastFour || 'None'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-3 justify-between items-center font-sans border-t border-slate-150 mt-4">
                          <button
                            type="button"
                            onClick={() => handleDeleteRegistration(selectedRegDetail)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer border border-rose-200 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Athlete Record</span>
                          </button>
                          <div className="flex gap-2">
                            <a
                              href={`/api/registrations/download/${selectedRegDetail._id}`}
                              download={`CombatFlow_Registration_${selectedRegDetail._id}.pdf`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer border border-slate-200 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-red-600" />
                              <span>Download PDF Slip</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => setIsEditingReg(true)}
                              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow cursor-pointer transition-colors"
                            >
                              Edit Credentials
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleSaveRegEdit} className="space-y-4 text-xs">
                        <div className="space-y-1">
                          <label className="block font-bold text-slate-700 uppercase">Athlete Full Name</label>
                          <input
                            type="text"
                            required
                            value={editingRegForm.fullName}
                            onChange={(e) => setEditingRegForm({ ...editingRegForm, fullName: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 uppercase">Birthdate (YYYY-MM-DD)</label>
                            <input
                              type="date"
                              required
                              value={editingRegForm.dob}
                              onChange={(e) => setEditingRegForm({ ...editingRegForm, dob: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 uppercase">Gender</label>
                            <select
                              value={editingRegForm.gender}
                              onChange={(e) => setEditingRegForm({ ...editingRegForm, gender: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 uppercase">Belt Rank</label>
                            <select
                              value={editingRegForm.beltRank}
                              onChange={(e) => setEditingRegForm({ ...editingRegForm, beltRank: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 capitalize"
                            >
                              {beltRanks.map((b, i) => <option key={i} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 uppercase">Weight Division</label>
                            <select
                              value={editingRegForm.weightCategory}
                              onChange={(e) => setEditingRegForm({ ...editingRegForm, weightCategory: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                            >
                              {allWeightDivisions.map((w, i) => <option key={i} value={w}>{w}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 uppercase">Coach/Academy</label>
                            <select
                              value={editingRegForm.coachName}
                              onChange={(e) => setEditingRegForm({ ...editingRegForm, coachName: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                            >
                              {parsedCoachesList.map((c, i) => <option key={i} value={c.name}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block font-bold text-slate-700 uppercase">Aadhar (Last 4 digits)</label>
                            <input
                              type="text"
                              maxLength={4}
                              required
                              value={editingRegForm.aadharLastFour}
                              onChange={(e) => setEditingRegForm({ ...editingRegForm, aadharLastFour: e.target.value.replace(/\D/g, '') })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block font-bold text-slate-700 uppercase">Verify Status Flag</label>
                          <select
                            value={editingRegForm.status}
                            onChange={(e) => setEditingRegForm({ ...editingRegForm, status: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </div>

                        <div className="flex gap-2.5 pt-4 border-t border-slate-100 justify-end">
                          <button
                            type="button"
                            onClick={() => setIsEditingReg(false)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            Back Details
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow cursor-pointer"
                          >
                            Save Athlete Profile
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* Delete Competitor Confirmation Modal */}
              {deletingReg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
                  <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full p-6 animate-scale-up space-y-4 font-sans">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                          Confirm Competitor Deletion
                        </h3>
                        <p className="text-xs text-slate-500">
                          Are you sure you want to permanently delete this competitor from the tournament pool?
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-sans text-slate-400 font-bold uppercase text-[10px]">Competitor Name</span>
                        <span className="font-extrabold text-slate-900 text-sm font-sans">{deletingReg.fullName || 'Selected Competitor'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-sans text-slate-400 font-bold uppercase text-[10px]">Registration ID</span>
                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{deletingReg._id || deletingReg.regId}</span>
                      </div>
                      {deletingReg.weightCategory && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-sans text-slate-400 font-bold uppercase text-[10px]">Weight Division</span>
                          <span className="font-semibold">{deletingReg.weightCategory}</span>
                        </div>
                      )}
                      {(deletingReg.coachName || deletingReg.clubName) && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-sans text-slate-400 font-bold uppercase text-[10px]">Coach / Academy</span>
                          <span className="font-semibold font-sans">{deletingReg.coachName || deletingReg.clubName}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100 leading-relaxed">
                      ⚠️ <strong>Warning:</strong> This action is irreversible. The competitor profile and verification slip will be permanently deleted and cleared from all active tournament rosters.
                    </p>

                    <div className="flex gap-2.5 pt-2 justify-end">
                      <button
                        type="button"
                        disabled={deletingLoading}
                        onClick={() => setDeletingReg(null)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deletingLoading}
                        onClick={handleConfirmDeleteRegistration}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {deletingLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Deleting Record...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Permanently Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Coaches Management */}
          {activeTab === 'coaches' && (
            <div className="space-y-6 animate-fade-in">
              {/* Add Custom Coach */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">Create / Register Tournament Coach</h3>
                <form onSubmit={handleAddCoach} className="flex gap-3 max-w-md">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Govind M"
                    value={newCoachName}
                    onChange={(e) => setNewCoachName(e.target.value)}
                    className="flex-grow px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-800 flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Coach</span>
                  </button>
                </form>
              </div>

              {/* Coach List */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-950 text-white p-4 text-xs font-bold font-mono uppercase tracking-wider">
                  Operational Coach Roster with Initials Prefix
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                        <th className="py-3 px-6">Coach Full Name</th>
                        <th className="py-3 px-6">Generated ID Prefix</th>
                        <th className="py-3 px-6">Next Registration Counter ID</th>
                        <th className="py-3 px-6">Registered Athletes Count</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {parsedCoachesList.map((coach, idx) => {
                        const nextIdNum = String(coach.playerCount + 1).padStart(3, '0');
                        const nextIdSample = `${coach.resolvedPrefix}_${nextIdNum}`;
                        const isEditing = isEditingCoachIdx === idx;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-4 px-6">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editingCoachVal}
                                    onChange={(e) => setEditingCoachVal(e.target.value)}
                                    className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-800"
                                  />
                                  <button
                                    onClick={() => handleUpdateCoach(idx)}
                                    className="p-1 bg-emerald-500 text-white rounded"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setIsEditingCoachIdx(null)}
                                    className="p-1 bg-slate-300 text-slate-700 rounded"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="font-extrabold text-slate-800 text-sm">{coach.name}</span>
                              )}
                            </td>
                            <td className="py-4 px-6 font-mono font-bold text-red-600 text-sm">
                              {coach.resolvedPrefix}
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-500 font-semibold">
                              {nextIdSample}
                            </td>
                            <td className="py-4 px-6 text-slate-600 font-bold">
                              {coach.playerCount}
                            </td>
                            <td className="py-4 px-6 text-right space-x-1">
                              {!isEditing && (
                                <>
                                  <button
                                    onClick={() => {
                                      setIsEditingCoachIdx(idx);
                                      setEditingCoachVal(coach.name);
                                    }}
                                    className="p-1.5 text-slate-600 bg-slate-100 border border-slate-250 rounded-md cursor-pointer hover:bg-slate-200 inline-block"
                                    title="Edit Coach Name"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCoach(coach.name)}
                                    className="p-1.5 text-red-600 bg-red-50 border border-red-200 rounded-md cursor-pointer hover:bg-red-100 inline-block"
                                    title="Delete Coach"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated Referee Staff Management */}
          {activeTab === 'referees' && (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-red-600" />
                    <span>Tournament Referee Staff Roster</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Provision official certified referee credentials, reset temporary scorepad passcodes, and control access to the dedicated referee console.
                  </p>
                </div>
              </div>

              {refereeActionError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{refereeActionError}</span>
                </div>
              )}

              {refereeActionSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{refereeActionSuccess}</span>
                </div>
              )}

              {/* Add Referee Provisioning Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-red-600" />
                      <span>Add Certified Referee Official</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Create an official login for mat chair judges. Referees cannot register themselves publicly.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-bold border border-red-200">
                    Admin Exclusive
                  </span>
                </div>

                <form onSubmit={handleCreateReferee} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase text-[10px]">
                      Official Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Master Jin-Woo Park"
                      value={refereeForm.name}
                      onChange={(e) => setRefereeForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase text-[10px]">
                      Official Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="referee@tkd.com"
                      value={refereeForm.email}
                      onChange={(e) => setRefereeForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase text-[10px]">
                      Temporary Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      value={refereeForm.password}
                      onChange={(e) => setRefereeForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase text-[10px]">
                      Contact Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 019-2834"
                      value={refereeForm.phone}
                      onChange={(e) => setRefereeForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={creatingReferee}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow disabled:opacity-50 transition-all"
                    >
                      {creatingReferee ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Registering Referee Account...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-red-500" />
                          <span>Provision Referee Official</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Referee Staff List & Management */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-red-500" />
                      <span>Certified Referee Directory ({referees.length} Registered)</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">Officials with electronic score pad access</p>
                  </div>

                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search referee by name/email..."
                      value={refereeSearch}
                      onChange={(e) => setRefereeSearch(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs rounded-lg focus:outline-none focus:border-red-500 placeholder-slate-500"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto text-xs font-sans">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                        <th className="py-3.5 px-6">Official Name</th>
                        <th className="py-3.5 px-6">Email / Login ID</th>
                        <th className="py-3.5 px-6">Phone</th>
                        <th className="py-3.5 px-6">Role / Access</th>
                        <th className="py-3.5 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {referees
                        .filter((r) => {
                          if (!refereeSearch) return true;
                          const q = refereeSearch.toLowerCase();
                          return (r.name || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q);
                        })
                        .map((ref) => (
                          <tr key={ref._id} className="hover:bg-slate-50/50">
                            <td className="py-4 px-6 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 font-mono font-bold text-xs">
                                  {ref.name?.charAt(0) || 'R'}
                                </div>
                                <span>{ref.name}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 font-mono text-slate-600 font-semibold">{ref.email}</td>
                            <td className="py-4 px-6 text-slate-500">{ref.phone || '—'}</td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-50 text-red-700 border border-red-200 uppercase">
                                <ShieldCheck className="w-3 h-3 text-red-600" /> REFEREE
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setResettingRefId(ref._id);
                                    setResetPasswordVal('');
                                  }}
                                  className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                                  title="Reset password"
                                >
                                  <KeyRound className="w-3 h-3 text-amber-600" />
                                  <span>Reset Pwd</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteReferee(ref._id, ref.name)}
                                  className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                                  title="Delete Referee Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                      {referees.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider text-xs">
                            No certified referees provisioned yet. Use the form above to add your first official.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Password Reset Modal */}
              {resettingRefId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-black text-slate-900 uppercase font-mono">Reset Referee Passcode</h3>
                      </div>
                      <button onClick={() => setResettingRefId(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleResetRefereePassword} className="space-y-4 text-xs font-sans">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700 uppercase text-[10px]">
                          New Temporary Passcode
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Min 6 characters"
                          value={resetPasswordVal}
                          onChange={(e) => setResetPasswordVal(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setResettingRefId(null)}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow cursor-pointer font-mono"
                        >
                          Save New Passcode
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Category & Weight Class Management */}
          {activeTab === 'categories' && (
            <div className="space-y-6 animate-fade-in font-sans">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Age & Weight Categories</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage and configure tournament-specific or global Taekwondo weight categories, age constraints, and audit registrations dynamically.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCategoryEvent !== 'global' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCopyFromEventId('global');
                        setShowCopyCategoryModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copy From Template / Event</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCategoryForm({
                        _id: '',
                        name: '',
                        minAge: 8,
                        maxAge: 32,
                        maleWeightClassesText: 'U-33 kg, U-37 kg, U-41 kg, U-45 kg',
                        femaleWeightClassesText: 'U-29 kg, U-33 kg, U-37 kg, U-41 kg'
                      });
                      setShowCategoryModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl shadow transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Category</span>
                  </button>
                </div>
              </div>

              {/* Event Scoping Selector Filter */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                    <Trophy className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-slate-400">Category Scope / Context</label>
                    <div className="text-xs font-bold text-slate-800">
                      {selectedCategoryEvent === 'global' ? 'Global Default Templates' : (events.find(e => e._id === selectedCategoryEvent)?.name || selectedCategoryEvent)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Scope to Tournament:</span>
                  <select
                    value={selectedCategoryEvent}
                    onChange={(e) => {
                      const newEvt = e.target.value;
                      setSelectedCategoryEvent(newEvt);
                      fetchCategories(newEvt);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-250 rounded-xl bg-slate-50 focus:bg-white text-slate-800 cursor-pointer min-w-[240px]"
                  >
                    <option value="global">🌐 Global Default Templates</option>
                    {events.map((evt) => (
                      <option key={evt._id} value={evt._id}>
                        🏆 {evt.name} ({evt.eventYear})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Copy Categories Modal */}
              {showCopyCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scale-up space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-mono">
                        Import Weight Categories
                      </h3>
                      <button onClick={() => setShowCopyCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Copy categories from an existing tournament or global templates into <strong className="text-slate-900">{events.find(e => e._id === selectedCategoryEvent)?.name || selectedCategoryEvent}</strong>. This creates an independent, fully isolated copy that you can edit without affecting other events.
                    </p>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase">Select Source Template</label>
                      <select
                        value={copyFromEventId}
                        onChange={(e) => setCopyFromEventId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-250 rounded-xl bg-slate-50 focus:bg-white text-slate-800"
                      >
                        <option value="global">🌐 Standard Global Default Templates</option>
                        {events
                          .filter(e => e._id !== selectedCategoryEvent)
                          .map((evt) => (
                            <option key={evt._id} value={evt._id}>
                              🏆 {evt.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex gap-2 justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => setShowCopyCategoryModal(false)}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloneCategories(copyFromEventId)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow"
                      >
                        Clone Categories to Event
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loadingCategories && categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-white border border-slate-200 rounded-2xl">
                  <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-semibold">Syncing dynamic classifications...</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {categories.map((cat) => {
                    const totalAthletes = registrations.filter(r => {
                      const age = calculateAgeOnEvent(r.dob);
                      return age >= cat.minAge && age <= cat.maxAge;
                    }).length;

                    return (
                      <div key={cat._id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        {/* Header banner */}
                        <div className="bg-slate-50 border-b border-slate-200/60 p-4 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-slate-900">{cat.name}</h3>
                              <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-200 text-slate-700 rounded-md font-mono">
                                Age {cat.minAge} - {cat.maxAge}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">ID: {cat._id}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold font-mono text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                              {totalAthletes} Registered Athletes
                            </span>
                            <button
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryForm({
                                  _id: cat._id,
                                  name: cat.name,
                                  minAge: cat.minAge,
                                  maxAge: cat.maxAge,
                                  maleWeightClassesText: (cat.maleWeightClasses || []).join(', '),
                                  femaleWeightClassesText: (cat.femaleWeightClasses || []).join(', ')
                                });
                                setShowCategoryModal(true);
                              }}
                              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                              title="Edit Classifications"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat._id)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-all cursor-pointer"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-5 grid sm:grid-cols-2 gap-6">
                          {/* Male classes list */}
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-600 flex justify-between items-center border-b border-blue-50 pb-1">
                              <span>Male Weight Classes</span>
                              <span className="text-[9px] text-slate-400">({(cat.maleWeightClasses || []).length} classes)</span>
                            </h4>
                            <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                              {(cat.maleWeightClasses || []).map((wc: string, idx: number) => {
                                const count = registrations.filter(r => r.gender === 'male' && r.weightCategory === wc).length;
                                return (
                                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-100 text-xs">
                                    <span className="font-semibold text-slate-700">{wc}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${count > 0 ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-200/50 text-slate-400'}`}>
                                      {count} entries
                                    </span>
                                  </div>
                                );
                              })}
                              {(cat.maleWeightClasses || []).length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">No weight classes added yet</p>
                              )}
                            </div>
                          </div>

                          {/* Female classes list */}
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-pink-600 flex justify-between items-center border-b border-pink-50 pb-1">
                              <span>Female Weight Classes</span>
                              <span className="text-[9px] text-slate-400">({(cat.femaleWeightClasses || []).length} classes)</span>
                            </h4>
                            <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                              {(cat.femaleWeightClasses || []).map((wc: string, idx: number) => {
                                const count = registrations.filter(r => r.gender === 'female' && r.weightCategory === wc).length;
                                return (
                                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-pink-100 text-xs">
                                    <span className="font-semibold text-slate-700">{wc}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${count > 0 ? 'bg-pink-50 text-pink-600 border border-pink-100' : 'bg-slate-200/50 text-slate-400'}`}>
                                      {count} entries
                                    </span>
                                  </div>
                                );
                              })}
                              {(cat.femaleWeightClasses || []).length === 0 && (
                                <p className="text-[10px] text-slate-400 italic">No weight classes added yet</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Form Modal popup */}
              {showCategoryModal && (
                <div className="fixed inset-0 z-55 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-scale-up">
                    <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                      <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-wider font-mono">
                        <Tag className="w-4 h-4 text-red-500" />
                        <span>{editingCategory ? 'Edit Category' : 'Create New Category'}</span>
                      </h3>
                      <button
                        onClick={() => setShowCategoryModal(false)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                      {/* Name */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category Name</label>
                        <input
                          type="text"
                          required
                          value={categoryForm.name}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Sub-Junior"
                          className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* Age ranges */}
                      <div className="grid grid-cols-2 gap-4 font-sans">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Minimum Age</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={categoryForm.minAge}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, minAge: parseInt(e.target.value, 10) }))}
                            className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Maximum Age</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={categoryForm.maxAge}
                            onChange={(e) => setCategoryForm(prev => ({ ...prev, maxAge: parseInt(e.target.value, 10) }))}
                            className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Male Weight Classes */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                          <span>Male Weight Classes</span>
                          <span className="text-slate-400 capitalize">Comma Separated</span>
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={categoryForm.maleWeightClassesText}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, maleWeightClassesText: e.target.value }))}
                          placeholder="e.g. U-18 kg, U-21 kg, U-23 kg, U-25 kg"
                          className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                        />
                      </div>

                      {/* Female Weight Classes */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex justify-between">
                          <span>Female Weight Classes</span>
                          <span className="text-slate-400 capitalize">Comma Separated</span>
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={categoryForm.femaleWeightClassesText}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, femaleWeightClassesText: e.target.value }))}
                          placeholder="e.g. U-16 kg, U-18 kg, U-20 kg, U-22 kg"
                          className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                        />
                      </div>

                      <div className="pt-2 flex justify-end gap-3 font-sans">
                        <button
                          type="button"
                          onClick={() => setShowCategoryModal(false)}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl shadow cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Draw Copy / Bracket Generation */}
          {activeTab === 'draws' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto font-sans text-xs">
                
                <div className="border-b border-slate-150 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider font-mono">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span>Auto-Generate Knockout Bracket Copy</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Select the target competitor pool class and division below. Clicking generate shuffles registered, verified athletes, handling BYE walkovers for odd rosters automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDrawRules(!showDrawRules)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer shrink-0 font-mono"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{showDrawRules ? 'Hide Draw Rules' : 'View Draw Rules (WT)'}</span>
                    {showDrawRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* World Taekwondo Official Knockout Draw & Seeding Rules Panel */}
                {showDrawRules && (
                  <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        <h4 className="font-bold text-xs uppercase font-mono tracking-wider text-amber-300">
                          Official World Taekwondo (WT) Knockout Draw & Seeding Rules
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                        WT Competition Rules Edition 2026
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                      {/* Rule 8.1 */}
                      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-emerald-400">
                          <span>WT Rule 8.1</span>
                          <span>•</span>
                          <span className="text-white">Single-Elimination Knockout</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          All divisions follow direct knockout progression. Winners advance sequentially (R16 → QF → SF → Finals). A single defeat eliminates the competitor from championship contention.
                        </p>
                      </div>

                      {/* Rule 8.2 */}
                      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-sky-400">
                          <span>WT Rule 8.2</span>
                          <span>•</span>
                          <span className="text-white">Seeded Bracket Halving</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          Seed #1 is placed at Position 1 (Top Half), Seed #2 at Position 2^k (Bottom Half). Seeds #3 & #4 are drawn to opposing quarters so the highest-ranked fighters meet exclusively in the Finals.
                        </p>
                      </div>

                      {/* Rule 8.3 */}
                      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-amber-400">
                          <span>WT Rule 8.3</span>
                          <span>•</span>
                          <span className="text-white">Club & Team Separation</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          Athletes from the same academy, club, or state team are automatically distributed into opposite bracket pools to prevent teammates from competing against each other in opening matches.
                        </p>
                      </div>

                      {/* Rule 8.4 */}
                      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-purple-400">
                          <span>WT Rule 8.4</span>
                          <span>•</span>
                          <span className="text-white">BYE Walkover Allocation</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          When roster count is not a power of 2 (e.g. 5, 7, 11), BYEs are algorithmically assigned to top seeded positions. Competitors receiving a BYE advance directly to Round 2 without fighting.
                        </p>
                      </div>

                      {/* Rule 12.1 */}
                      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-rose-400">
                          <span>WT Rule 12.1</span>
                          <span>•</span>
                          <span className="text-white">Best-of-3 Bout Format</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          Matches consist of Best-of-3 rounds (2 minutes each, 1-min break). Valid impacts require PSS electronic threshold confirmation. Point Gap (12-pt lead) and Gam-jeom (penalty) limits apply.
                        </p>
                      </div>

                      {/* Rule 19.1 */}
                      <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-yellow-400">
                          <span>WT Rule 19.1</span>
                          <span>•</span>
                          <span className="text-white">Dual Bronze Medal Distribution</span>
                        </div>
                        <p className="text-slate-300 text-[10px]">
                          Both semi-final losers automatically receive 3rd Place (Dual Bronze medals). There is no 3rd place playoff match. Official certificates are generated and emailed upon bracket completion.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>✓ Draw Integrity: Draft sheets are hidden from athletes until administrator publication</span>
                      <span>🔒 Cryptographic Match ID Verification Active</span>
                    </div>
                  </div>
                )}

                {bracketError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-lg font-mono">
                    {bracketError}
                  </div>
                )}

                {bracketSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold p-3.5 rounded-lg font-mono">
                    {bracketSuccess}
                  </div>
                )}

                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Target Tournament Event
                    </label>
                    <select
                      value={selectedDrawEvent}
                      onChange={(e) => setSelectedDrawEvent(e.target.value)}
                      className="block w-full text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2.5 rounded-lg bg-slate-50 cursor-pointer font-mono"
                    >
                      {events.map((evt: any) => (
                        <option key={evt._id} value={evt._id}>{evt.name}</option>
                      ))}
                      {events.length === 0 && <option value="evt_autumn2026">Autumn National 2026</option>}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Age Category Division
                    </label>
                    <select
                      value={bracketAgeCategory}
                      onChange={(e) => setBracketAgeCategory(e.target.value)}
                      className="block w-full text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2.5 rounded-lg bg-slate-50 cursor-pointer font-mono"
                    >
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat.name}>{cat.name}</option>
                      ))}
                      {categories.length === 0 && (
                        <>
                          <option value="Sub-Junior">Sub-Junior</option>
                          <option value="Cadet">Cadet</option>
                          <option value="Junior">Junior</option>
                          <option value="Senior">Senior</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Competitor Pool Gender
                    </label>
                    <select
                      value={bracketGender}
                      onChange={(e) => setBracketGender(e.target.value as any)}
                      className="block w-full text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2.5 rounded-lg bg-slate-50 cursor-pointer font-mono"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Weight Category Division
                    </label>
                    <select
                      value={bracketWeight}
                      onChange={(e) => setBracketWeight(e.target.value)}
                      className="block w-full text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2.5 rounded-lg bg-slate-50 cursor-pointer font-mono"
                    >
                      {(bracketGender === 'male' ? maleWeightDivisions : femaleWeightDivisions).map((cat: string, idx: number) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Target Bracket Size
                    </label>
                    <select
                      value={targetBracketSize}
                      onChange={(e) => setTargetBracketSize(e.target.value)}
                      className="block w-full text-xs font-semibold text-slate-700 border border-slate-200 px-3 py-2.5 rounded-lg bg-slate-50 cursor-pointer font-mono"
                    >
                      <option value="auto">Auto (Calculated by Athlete Count)</option>
                      <option value="4">4 Competitors (Semifinals)</option>
                      <option value="8">8 Competitors (Quarterfinals)</option>
                      <option value="16">16 Competitors (Round of 16)</option>
                    </select>
                  </div>
                </div>

                {/* Category Competitor Audit & Verification Widget */}
                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-red-500" />
                      <span className="font-bold text-xs uppercase font-mono tracking-wider">
                        Competitor Pool Audit: {bracketAgeCategory} • {bracketWeight} ({bracketGender.toUpperCase()})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        (catStats?.registeredCount || 0) === (catStats?.bracketCount || 0) && (catStats?.registeredCount || 0) > 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : (catStats?.missingAthletes?.length || 0) > 0
                          ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {catStats ? `${catStats.registeredCount} Registered / ${catStats.bracketCount} In Draw` : 'Loading audit...'}
                      </span>
                    </div>
                  </div>

                  {/* Registered Athletes List */}
                  {catStats && catStats.registeredAthletes && catStats.registeredAthletes.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Registered Athletes ({catStats.registeredAthletes.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                        {catStats.registeredAthletes.map((ath: any, i: number) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono ${
                              ath.inBracket
                                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                                : 'bg-rose-900/50 text-rose-300 border border-rose-600 animate-pulse'
                            }`}
                          >
                            <span>{ath.fullName}</span>
                            <span className="text-[9px] opacity-75">({ath.coach})</span>
                            <span className="text-[9px] font-extrabold">{ath.inBracket ? '✓' : '⚠️ Missing'}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      No registered athletes found matching this category yet.
                    </p>
                  )}

                  {/* Warning if missing athletes detected */}
                  {catStats && catStats.missingAthletes && catStats.missingAthletes.length > 0 && (
                    <div className="bg-amber-950/70 border border-amber-700/60 p-2.5 rounded-lg text-amber-200 text-[11px] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong>{catStats.missingAthletes.length} registered player(s)</strong> not present in the current bracket ({catStats.missingAthletes.map((a: any) => a.fullName).join(', ')}).
                        </span>
                      </div>
                      {drawStatus !== 'finalized' && (
                        <button
                          onClick={handleGenerateBracket}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          Sync & Include All
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Seeding & Placeholder Options */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowPlaceholders}
                      onChange={(e) => setAllowPlaceholders(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700">
                      Auto-seed with TBD slots / BYEs if fewer than target competitors registered
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                    {allowPlaceholders ? '✓ Seeding Guaranteed' : 'Strict (>=2 Required)'}
                  </span>
                </div>

                {/* Draw status info block */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  drawStatus === 'finalized'
                    ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        drawStatus === 'finalized' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                      }`} />
                      <span className="font-bold text-xs uppercase tracking-wider font-mono">
                        Draw Status: {drawStatus === 'finalized' ? '🔒 FINALIZED & PUBLISHED TO PLAYERS' : '📝 DRAFT DRAW SHEET'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {drawStatus === 'finalized'
                        ? 'This draw copy is currently published live to athletes. You can edit any bout directly below and click "Republish Draw" to sync updates.'
                        : 'This draw is in draft state. Athletes and spectators cannot view bracket pairings until you click Publish.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {drawStatus === 'finalized' ? (
                      <>
                        <button
                          onClick={handleUnlockDraw}
                          className="px-3.5 py-1.5 text-[11px] font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg cursor-pointer transition-all shadow-xs"
                          title="Switch to draft state to hide live bracket temporarily"
                        >
                          🔓 Unlock to Draft
                        </button>
                        <button
                          onClick={handleRepublishDraw}
                          className="px-3.5 py-1.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white border border-amber-600 rounded-lg cursor-pointer shadow transition-all flex items-center gap-1.5"
                          title="Broadcast latest bracket updates and bouts to all live connected viewers"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Republish Draw 🚀</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleFinalizeDraw}
                        className="px-4 py-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-lg cursor-pointer shadow transition-all flex items-center gap-1.5 uppercase font-mono tracking-wide"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Publish & Finalize Draw</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleGenerateBracket}
                    disabled={drawStatus === 'finalized'}
                    className="flex-grow inline-flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent active:scale-98 rounded-xl transition-all cursor-pointer shadow-md uppercase font-mono tracking-wider"
                  >
                    <Swords className="w-4 h-4 text-red-500" />
                    <span>{matches.length > 0 ? 'Regenerate Knockout Draw (Include All)' : 'Generate Seeding Bracket Draw'}</span>
                  </button>
                </div>
                {drawStatus === 'finalized' && (
                  <p className="text-[10px] text-center text-slate-400 mt-1">
                    Draw is finalized and locked. To regenerate or modify the entire tree, click "Unlock to Draft" above.
                  </p>
                )}
              </div>

              {/* Certificates & Medal Standings Delivery Control Console */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Championship Medal Standing & Certificate Delivery</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-sans leading-relaxed">
                      Generate and dispatch PDF certificates for completed category final standing. Automatically emailed on finalization.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleGenerateCertificates(false)}
                      disabled={certActionLoading}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Auto-generate certificates and deliver them to 1st, 2nd, and 3rd place players"
                    >
                      {certActionLoading ? 'Processing...' : '🏅 Generate & Send Certificates'}
                    </button>
                    <button
                      onClick={() => handleGenerateCertificates(true)}
                      disabled={certActionLoading}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Force-regenerate and resend certificates to all placers"
                    >
                      🔄 Force Resend All
                    </button>
                  </div>
                </div>

                {certMessage && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-medium border border-emerald-100">
                    {certMessage}
                  </div>
                )}

                {certError && (
                  <div className="p-3 bg-red-50 text-red-800 rounded-xl text-xs font-medium border border-red-100">
                    {certError}
                  </div>
                )}

                {loadingStandings ? (
                  <p className="text-xs text-slate-400 text-center py-4 font-mono">Loading standing details...</p>
                ) : standings.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-xs">
                    <AlertCircle className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                    <span className="font-medium">Standings are automatically finalized when category matches are completed.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {standings.map((st) => (
                      <div key={st._id} className="p-3 border border-slate-150 rounded-xl flex items-center justify-between gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border font-mono ${
                            st.position === '1st' 
                              ? 'bg-amber-100 text-amber-800 border-amber-200 shadow-xs' 
                              : st.position === '2nd'
                                ? 'bg-slate-100 text-slate-800 border-slate-200 shadow-xs'
                                : 'bg-orange-50 text-orange-800 border-orange-200 shadow-xs'
                          }`}>
                            {st.position === '1st' ? '1st' : st.position === '2nd' ? '2nd' : '3rd'}
                          </span>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900 uppercase font-mono">{st.fullName}</h5>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span>ID: {st.registrationId}</span>
                              <span>•</span>
                              <span className={`font-semibold ${st.emailSent ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {st.emailSent ? '✓ Emailed' : '✗ Email Failed'}
                              </span>
                              {st.emailSentAt && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(st.emailSentAt).toLocaleTimeString()}</span>
                                </>
                              )}
                              {st.emailError && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-500 font-medium" title={st.emailError}>({st.emailError.substring(0, 30)})</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {st.certificateUrl && (
                            <a
                              href={st.certificateUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-all shadow-xs shrink-0"
                            >
                              View PDF
                            </a>
                          )}
                          <button
                            onClick={() => handleResendSingleCertificate(st._id)}
                            disabled={certActionLoading}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-xs shrink-0"
                            title="Resend certificate directly to player"
                          >
                            Resend
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

               {/* Bracket results and print trigger */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="printable-bracket-section">
                <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold font-mono uppercase">
                  <span>Match Order Draws: {bracketAgeCategory} - {bracketWeight} ({bracketGender.toUpperCase()})</span>
                  <div className="flex items-center gap-2">
                    {/* View Switcher: Interactive D3 Tree vs Table */}
                    <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                      <button
                        onClick={() => setBracketViewMode('visualizer')}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                          bracketViewMode === 'visualizer' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Interactive D3 tournament tree progression"
                      >
                        <Eye className="w-3 h-3" />
                        <span>D3 Tree</span>
                      </button>
                      <button
                        onClick={() => setBracketViewMode('table')}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                          bracketViewMode === 'table' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Tabular match ref and scoring desk view"
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span>Table</span>
                      </button>
                    </div>

                    {drawStatus === 'finalized' && (
                      <button
                        onClick={handleRepublishDraw}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded border border-amber-500/40 flex items-center gap-1 text-[10px] cursor-pointer"
                        title="Republish latest matchup edits"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-400" />
                        <span>Republish</span>
                      </button>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="bg-slate-800 hover:bg-slate-750 px-3 py-1 rounded border border-slate-700 flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-red-500" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {bracketViewMode === 'visualizer' ? (
                  <div className="p-4 bg-slate-950">
                    <BracketVisualizer
                      matches={matches.filter(m => {
                        const genderMatch = (m.gender || '').toLowerCase() === bracketGender.toLowerCase();
                        const weightMatch = m.weightCategory === bracketWeight || 
                          (m.weightCategory || '').toLowerCase().replace(/^(male|female)\s+/i, '').replace(/^(u-|under\s*|-)/i, '').replace(/\s+/g, '') === 
                          (bracketWeight || '').toLowerCase().replace(/^(male|female)\s+/i, '').replace(/^(u-|under\s*|-)/i, '').replace(/\s+/g, '');
                        const ageMatch = !m.ageCategory || m.ageCategory.toLowerCase() === bracketAgeCategory.toLowerCase();
                        const eventMatch = !m.eventId || m.eventId === selectedDrawEvent;
                        return genderMatch && weightMatch && ageMatch && eventMatch;
                      })}
                      title={`${bracketAgeCategory} • ${bracketWeight} (${bracketGender.toUpperCase()})`}
                      onMatchClick={(m) => handleOpenMatchEdit(m)}
                    />
                  </div>
                ) : (
                <div className="overflow-x-auto text-xs font-sans">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                        <th className="py-3 px-6">Match Ref</th>
                        <th className="py-3 px-6">Round Category</th>
                        <th className="py-3 px-6">Competitors Group (Red vs Blue Corner)</th>
                        <th className="py-3 px-6">Live Status</th>
                        <th className="py-3 px-6 text-right">Scoring desk</th>
                        <th className="py-3 px-6 text-center">Bout Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {matches
                        .filter(m => {
                          const genderMatch = (m.gender || '').toLowerCase() === bracketGender.toLowerCase();
                          const weightMatch = m.weightCategory === bracketWeight || 
                            (m.weightCategory || '').toLowerCase().replace(/^(male|female)\s+/i, '').replace(/^(u-|under\s*|-)/i, '').replace(/\s+/g, '') === 
                            (bracketWeight || '').toLowerCase().replace(/^(male|female)\s+/i, '').replace(/^(u-|under\s*|-)/i, '').replace(/\s+/g, '');
                          const ageMatch = !m.ageCategory || m.ageCategory.toLowerCase() === bracketAgeCategory.toLowerCase();
                          const eventMatch = !m.eventId || m.eventId === selectedDrawEvent;
                          return genderMatch && weightMatch && ageMatch && eventMatch;
                        })
                        .map((m, index) => (
                          <tr key={m._id} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-6 font-mono font-bold text-slate-400">{m._id.toUpperCase()}</td>
                            <td className="py-3.5 px-6 font-bold text-slate-700">{m.round}</td>
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-4 text-xs font-bold text-slate-800">
                                <span className="text-red-600 bg-red-50 border border-red-200/50 px-2 py-0.5 rounded text-[10px] tracking-wide shrink-0">Chung (Red): {m.player1Name}</span>
                                <span className="text-slate-300 font-mono">VS</span>
                                <span className="text-blue-600 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded text-[10px] tracking-wide shrink-0">Hong (Blue): {m.player2Name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-6">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                m.status === 'live' ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse' :
                                m.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                                'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}>
                                {m.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right font-bold text-slate-700 font-mono">
                              {m.score.player1} - {m.score.player2}
                            </td>
                            <td className="py-3.5 px-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleSwapCorners(m)}
                                  className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 font-mono font-bold uppercase text-[9px] border border-slate-200/60"
                                  title="Quick swap Red (Chung) & Blue (Hong) corners"
                                >
                                  <ArrowLeftRight className="w-3 h-3 text-amber-600" />
                                  <span>Swap</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingMatch(m);
                                    setMatchForm({
                                      _id: m._id,
                                      player1Name: m.player1Name,
                                      player2Name: m.player2Name,
                                      player1Id: m.player1Id || '',
                                      player2Id: m.player2Id || '',
                                      round: m.round,
                                      status: m.status,
                                      score1: m.score.player1,
                                      score2: m.score.player2,
                                      winnerId: m.winnerId || ''
                                    });
                                    setShowMatchModal(true);
                                  }}
                                  className="p-1.5 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 font-mono font-bold uppercase text-[9px] border border-slate-200/60"
                                  title="Edit Match Details, Athletes, or Seeding"
                                >
                                  <Edit className="w-3 h-3 text-blue-600" />
                                  <span>Edit Bout</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                      {matches.filter(m => {
                        const genderMatch = (m.gender || '').toLowerCase() === bracketGender.toLowerCase();
                        const weightMatch = m.weightCategory === bracketWeight || 
                          (m.weightCategory || '').toLowerCase().replace(/^(male|female)\s+/i, '').replace(/^(u-|under\s*|-)/i, '').replace(/\s+/g, '') === 
                          (bracketWeight || '').toLowerCase().replace(/^(male|female)\s+/i, '').replace(/^(u-|under\s*|-)/i, '').replace(/\s+/g, '');
                        const ageMatch = !m.ageCategory || m.ageCategory.toLowerCase() === bracketAgeCategory.toLowerCase();
                        const eventMatch = !m.eventId || m.eventId === selectedDrawEvent;
                        return genderMatch && weightMatch && ageMatch && eventMatch;
                      }).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold uppercase tracking-wider">No matches configured. Execute drawing bracket above.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                )}
              </div>

              {/* Match Draw Copy Edit Modal */}
              {showMatchModal && (
                <div className="fixed inset-0 z-55 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-scale-up">
                    <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-wider font-mono">
                          <Swords className="w-4 h-4 text-red-500" />
                          <span>Edit Bracket Match Bout</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: #{matchForm._id.toUpperCase()}</p>
                      </div>
                      <button
                        onClick={() => setShowMatchModal(false)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Datalist for registered category athletes autocomplete */}
                    <datalist id="category-registered-athletes">
                      {registrations
                        .filter(r => {
                          const gMatch = !r.gender || r.gender.toLowerCase() === bracketGender.toLowerCase();
                          const wMatch = !r.weightCategory || r.weightCategory.toLowerCase() === bracketWeight.toLowerCase();
                          return gMatch && wMatch;
                        })
                        .map(r => (
                          <option key={r._id} value={r.fullName}>
                            {r.clubOrState ? `${r.fullName} (${r.clubOrState})` : r.fullName}
                          </option>
                        ))}
                    </datalist>

                    <form onSubmit={(e) => handleSaveMatchEdit(e, false)} className="p-6 space-y-4">
                      {/* Round Name */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Round Name / Stage</label>
                        <input
                          type="text"
                          required
                          value={matchForm.round}
                          onChange={(e) => setMatchForm(prev => ({ ...prev, round: e.target.value }))}
                          placeholder="e.g. Quarterfinals, Finals, Round of 16"
                          className="w-full px-3.5 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        />
                      </div>

                      {/* Quick Swap Corners Bar */}
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                        <span className="text-[11px] font-bold text-slate-600 font-mono uppercase">Competitor Assignments</span>
                        <button
                          type="button"
                          onClick={() => {
                            setMatchForm(prev => ({
                              ...prev,
                              player1Name: prev.player2Name,
                              player2Name: prev.player1Name,
                              player1Id: prev.player2Id,
                              player2Id: prev.player1Id,
                              score1: prev.score2,
                              score2: prev.score1
                            }));
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <ArrowLeftRight className="w-3 h-3 text-amber-600" />
                          <span>⇄ Swap Corners</span>
                        </button>
                      </div>

                      {/* Red Corner (Chung) */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex items-center justify-between">
                          <span>Chung (Red Corner) Athlete Name</span>
                          <span className="text-[9px] text-slate-400 font-normal">Registered or Custom</span>
                        </label>
                        <input
                          type="text"
                          required
                          list="category-registered-athletes"
                          value={matchForm.player1Name}
                          onChange={(e) => setMatchForm(prev => ({ ...prev, player1Name: e.target.value }))}
                          placeholder="Select from registered pool or type athlete name"
                          className="w-full px-3.5 py-2 border border-red-200 rounded-xl text-xs focus:ring-2 focus:ring-red-600 focus:outline-none bg-red-50/20"
                        />
                      </div>

                      {/* Blue Corner (Hong) */}
                      <div className="space-y-1 font-sans">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center justify-between">
                          <span>Hong (Blue Corner) Athlete Name</span>
                          <span className="text-[9px] text-slate-400 font-normal">Registered or Custom</span>
                        </label>
                        <input
                          type="text"
                          required
                          list="category-registered-athletes"
                          value={matchForm.player2Name}
                          onChange={(e) => setMatchForm(prev => ({ ...prev, player2Name: e.target.value }))}
                          placeholder="Select from registered pool or type athlete name"
                          className="w-full px-3.5 py-2 border border-blue-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none bg-blue-50/20"
                        />
                      </div>

                      {/* Scores & Status */}
                      <div className="grid grid-cols-3 gap-3 font-sans">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-red-500">Chung Pts</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={matchForm.score1}
                            onChange={(e) => setMatchForm(prev => ({ ...prev, score1: parseInt(e.target.value, 10) || 0 }))}
                            className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Hong Pts</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={matchForm.score2}
                            onChange={(e) => setMatchForm(prev => ({ ...prev, score2: parseInt(e.target.value, 10) || 0 }))}
                            className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</label>
                          <select
                            value={matchForm.status}
                            onChange={(e) => setMatchForm(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full px-2 py-2 border border-slate-250 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50 font-semibold text-slate-700 cursor-pointer"
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="live">Live</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 font-sans">
                        <button
                          type="button"
                          onClick={() => setShowMatchModal(false)}
                          className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-xs font-bold text-white rounded-xl shadow cursor-pointer transition-all"
                          >
                            Save Changes
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleSaveMatchEdit(e, true)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5"
                            title="Save bout edits and republish instantly to players and live viewers"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Save & Republish 🚀</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Live Match Control */}
          {activeTab === 'live' && (() => {
            const activeAgeCategory = scorerAgeFilter !== 'all' ? scorerAgeFilter : bracketAgeCategory;
            const activeCatObj = categories.find(c => c.name.toLowerCase() === activeAgeCategory.toLowerCase());
            const relevantMaleWeights = activeCatObj?.maleWeightClasses || maleWeightDivisions;
            const relevantFemaleWeights = activeCatObj?.femaleWeightClasses || femaleWeightDivisions;

            let weightOptionsForFilter: string[] = [];
            if (scorerGenderFilter === 'male') {
              weightOptionsForFilter = relevantMaleWeights;
            } else if (scorerGenderFilter === 'female') {
              weightOptionsForFilter = relevantFemaleWeights;
            } else {
              weightOptionsForFilter = Array.from(new Set([...relevantMaleWeights, ...relevantFemaleWeights]));
            }

            const filteredMatches = matches.filter(m => {
              // Event filter
              if (scorerEventFilter !== 'all') {
                if (m.eventId && m.eventId !== scorerEventFilter) return false;
              }
              // Age Category filter
              if (scorerAgeFilter !== 'all') {
                if (m.ageCategory && m.ageCategory.toLowerCase() !== scorerAgeFilter.toLowerCase()) return false;
              }
              // Gender filter
              if (scorerGenderFilter !== 'all') {
                if (m.gender && m.gender.toLowerCase() !== scorerGenderFilter.toLowerCase()) return false;
              }
              // Weight Category filter
              if (scorerWeightFilter !== 'all') {
                if (m.weightCategory) {
                  const mNorm = m.weightCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const fNorm = scorerWeightFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (m.weightCategory !== scorerWeightFilter && !mNorm.includes(fNorm) && !fNorm.includes(mNorm)) {
                    return false;
                  }
                } else {
                  return false;
                }
              }
              // Status filter
              if (scorerStatusFilter !== 'all') {
                if (m.status !== scorerStatusFilter) return false;
              }
              return true;
            });

            const hasActiveFilters = scorerGenderFilter !== 'all' || scorerWeightFilter !== 'all' || scorerAgeFilter !== 'all' || scorerEventFilter !== 'all' || scorerStatusFilter !== 'all';

            return (
              <div className="space-y-6 animate-fade-in">
                {/* Comprehensive Operational Filter Toolbar */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-red-600 animate-pulse shrink-0" />
                      <h2 className="font-mono font-black text-slate-900 text-xs uppercase tracking-wider">
                        Operational Match Filter ({filteredMatches.length} / {matches.length} Bouts)
                      </h2>
                    </div>

                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setScorerGenderFilter('all');
                          setScorerWeightFilter('all');
                          setScorerAgeFilter('all');
                          setScorerEventFilter('all');
                          setScorerStatusFilter('all');
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition-colors font-mono flex items-center gap-1 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Filters</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                    {/* Event Filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-400">Tournament Event</label>
                      <select
                        value={scorerEventFilter}
                        onChange={(e) => setScorerEventFilter(e.target.value)}
                        className="w-full font-semibold text-slate-800 border border-slate-250 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white cursor-pointer"
                      >
                        <option value="all">All Events ({events.length})</option>
                        {events.map((evt) => (
                          <option key={evt._id} value={evt._id}>{evt.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Age Category Filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-400">Age Division</label>
                      <select
                        value={scorerAgeFilter}
                        onChange={(e) => {
                          setScorerAgeFilter(e.target.value);
                          setScorerWeightFilter('all');
                        }}
                        className="w-full font-semibold text-slate-800 border border-slate-250 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white cursor-pointer"
                      >
                        <option value="all">All Age Classes</option>
                        {ageCategories.map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Gender Filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-400">Gender Class</label>
                      <select
                        value={scorerGenderFilter}
                        onChange={(e) => {
                          setScorerGenderFilter(e.target.value as any);
                          setScorerWeightFilter('all');
                        }}
                        className="w-full font-semibold text-slate-800 border border-slate-250 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white cursor-pointer"
                      >
                        <option value="all">All Genders</option>
                        <option value="male">Male Classes</option>
                        <option value="female">Female Classes</option>
                      </select>
                    </div>

                    {/* Weight Category Filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-400">Weight Division</label>
                      <select
                        value={scorerWeightFilter}
                        onChange={(e) => setScorerWeightFilter(e.target.value)}
                        className="w-full font-semibold text-slate-800 border border-slate-250 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white cursor-pointer"
                      >
                        <option value="all">All Weight Divisions</option>
                        {weightOptionsForFilter.map((cat: string, idx: number) => (
                          <option key={idx} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Match Status Filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono font-bold uppercase text-slate-400">Match Status</label>
                      <select
                        value={scorerStatusFilter}
                        onChange={(e) => setScorerStatusFilter(e.target.value as any)}
                        className="w-full font-semibold text-slate-800 border border-slate-250 px-3 py-2 rounded-xl bg-slate-50 focus:bg-white cursor-pointer"
                      >
                        <option value="all">All Statuses</option>
                        <option value="live">🔴 Live Scoring Active</option>
                        <option value="upcoming">⏳ Upcoming / Ready</option>
                        <option value="completed">✅ Completed / Ended</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Grid matching controller scorecards */}
                {filteredMatches.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {filteredMatches.map((match) => {
                      const isLive = match.status === 'live';
                      const isCompleted = match.status === 'completed';

                      return (
                        <div 
                          key={match._id} 
                          className={`bg-white rounded-2xl border p-6 shadow-md transition-all relative ${
                            isLive ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200/80'
                          }`}
                        >
                          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4 text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 uppercase">
                                {match.round ? match.round.toUpperCase() : 'ROUND 1'}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">
                                {match.weightCategory || 'Open Weight'} ({match.gender?.toUpperCase() || 'M/F'})
                              </span>
                            </div>
                            
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                <span>Live scoring active</span>
                              </span>
                            ) : isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase">
                                <span>Ended</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full uppercase">
                                <span>Pending</span>
                              </span>
                            )}
                          </div>

                          {/* Interactive Combat Scoring Pad */}
                          <div className="space-y-4 font-sans text-xs">
                            
                            {/* Player 1 Red */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                <span className={`font-bold text-slate-800 ${
                                  isCompleted && match.winnerId === match.player1Id ? 'underline decoration-amber-500 decoration-2 font-black text-red-600' : ''
                                }`}>
                                  {match.player1Name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5">
                                {isLive && (
                                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                                    <button
                                      onClick={() => updateMatchScore(match._id, 'player1', -1)}
                                      className="w-6 h-6 flex items-center justify-center bg-white border border-slate-100 text-slate-700 hover:bg-slate-50 rounded shadow-sm text-xs cursor-pointer font-extrabold"
                                    >
                                      -1
                                    </button>
                                    <button
                                      onClick={() => updateMatchScore(match._id, 'player1', 1)}
                                      className="w-6 h-6 flex items-center justify-center bg-white border border-slate-100 text-slate-700 hover:bg-slate-50 rounded shadow-sm text-xs cursor-pointer font-extrabold"
                                    >
                                      +1
                                    </button>
                                    <button
                                      onClick={() => updateMatchScore(match._id, 'player1', 2)}
                                      className="w-6 h-6 flex items-center justify-center bg-red-600 text-white rounded shadow-sm text-[10px] cursor-pointer font-extrabold"
                                    >
                                      +2
                                    </button>
                                  </div>
                                )}
                                <span className="text-2xl font-mono font-black text-red-600 min-w-[24px] text-right">
                                  {match.score.player1}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-center relative my-1">
                              <div className="absolute w-full h-[1px] bg-slate-150" />
                              <span className="relative bg-white px-2 text-[9px] font-bold text-slate-400 font-mono">SPLIT CORNER</span>
                            </div>

                            {/* Player 2 Blue */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                                <span className={`font-bold text-slate-800 ${
                                  isCompleted && match.winnerId === match.player2Id ? 'underline decoration-amber-500 decoration-2 font-black text-blue-600' : ''
                                }`}>
                                  {match.player2Name}
                                </span>
                              </div>

                              <div className="flex items-center gap-2.5">
                                {isLive && (
                                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                                    <button
                                      onClick={() => updateMatchScore(match._id, 'player2', -1)}
                                      className="w-6 h-6 flex items-center justify-center bg-white border border-slate-100 text-slate-700 hover:bg-slate-50 rounded shadow-sm text-xs cursor-pointer font-extrabold"
                                    >
                                      -1
                                    </button>
                                    <button
                                      onClick={() => updateMatchScore(match._id, 'player2', 1)}
                                      className="w-6 h-6 flex items-center justify-center bg-white border border-slate-100 text-slate-700 hover:bg-slate-50 rounded shadow-sm text-xs cursor-pointer font-extrabold"
                                    >
                                      +1
                                    </button>
                                    <button
                                      onClick={() => updateMatchScore(match._id, 'player2', 2)}
                                      className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded shadow-sm text-[10px] cursor-pointer font-extrabold"
                                    >
                                      +2
                                    </button>
                                  </div>
                                )}
                                <span className="text-2xl font-mono font-black text-blue-600 min-w-[24px] text-right">
                                  {match.score.player2}
                                </span>
                              </div>
                            </div>

                          </div>

                          {/* Status Control Actions */}
                          <div className="pt-4 mt-5 border-t border-slate-100 flex gap-2">
                            {!isLive && !isCompleted && (
                              <button
                                onClick={() => updateMatchStatus(match._id, 'live')}
                                className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm cursor-pointer uppercase tracking-wider font-mono"
                              >
                                Activate Scorecard
                              </button>
                            )}

                            {isLive && (
                              <button
                                onClick={() => updateMatchStatus(match._id, 'completed')}
                                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm cursor-pointer uppercase tracking-wider font-mono"
                              >
                                Declare Fight Final Winner
                              </button>
                            )}

                            {isCompleted && (
                              <button
                                onClick={() => updateMatchStatus(match._id, 'live')}
                                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer uppercase font-mono"
                              >
                                Reopen Scorecard
                              </button>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
                    <Swords className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-black text-slate-800 font-mono uppercase">
                      No Bracket Pairing Matches Detected For Selected Filter
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      {matches.length === 0
                        ? 'No matches exist in the system yet. Generate brackets in "Knockout Draws Copy" first.'
                        : `There are ${matches.length} total matches in the system, but none match the active filter options.`}
                    </p>
                    {hasActiveFilters && matches.length > 0 && (
                      <button
                        onClick={() => {
                          setScorerGenderFilter('all');
                          setScorerWeightFilter('all');
                          setScorerAgeFilter('all');
                          setScorerEventFilter('all');
                          setScorerStatusFilter('all');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs uppercase rounded-xl cursor-pointer shadow-md transition-all mt-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-red-500" />
                        <span>Show All {matches.length} Bouts</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 8. Gallery Management */}
          {activeTab === 'gallery' && (
            <div className="space-y-6 animate-fade-in">
              {/* Photo Upload Form */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">Upload Event Photo to Broadcast Feed</h3>
                
                {uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}
                {uploadSuccess && <p className="text-xs font-bold text-emerald-600">{uploadSuccess}</p>}

                <form onSubmit={handleUploadPhoto} className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase">Image File</label>
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        required
                        onChange={handleFileChange}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase">Caption text</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Finals Kick Sparring"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="mt-2">
                      <p className="font-bold text-slate-500 mb-1 uppercase text-[10px]">Preview Upload:</p>
                      <img src={previewUrl} alt="Preview" className="h-28 rounded-lg object-cover border" />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 hover:bg-slate-800"
                  >
                    {uploading ? 'Uploading...' : 'Publish Photo to Gallery'}
                  </button>
                </form>
              </div>

              {/* Gallery List */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">Gallery Broadcast Stream Items ({galleryImages.length} Photos)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {galleryImages.map((img) => (
                    <div key={img._id} className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                      <img src={img.imageUrl} alt={img.caption} className="w-full h-32 object-cover" />
                      <div className="p-2 text-[10px] text-slate-600 font-medium truncate bg-white">{img.caption}</div>
                      <button
                        onClick={() => handleDeleteImage(img._id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {galleryImages.length === 0 && (
                    <div className="col-span-4 text-center py-10 text-slate-400 font-semibold uppercase tracking-wider text-xs">
                      No event photos broadcasted yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 9. SMTP Mailer Settings */}
          {activeTab === 'smtp' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">SMTP Server Configuration</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Configure your own real SMTP server credentials (e.g. Gmail App Password, SendGrid, Mailgun) to send live verification emails directly to players.</p>
                  </div>
                  {process.env.NODE_ENV !== 'production' && (
                    <div className="bg-amber-50 border border-amber-200 px-2 py-1 rounded text-[10px] text-amber-700 font-bold uppercase animate-pulse">
                      In Development Mode
                    </div>
                  )}
                </div>

                {smtpError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-lg">
                    {smtpError}
                  </div>
                )}
                {smtpSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold p-3.5 rounded-lg">
                    {smtpSuccess}
                  </div>
                )}

                <form onSubmit={handleSaveSMTPSettings} className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase">SMTP Host Server</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. smtp.gmail.com"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase">SMTP Port</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 587 or 465"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase">SMTP Username (User Email)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. account@domain.com"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700 uppercase">
                        SMTP Password {smtpHasPassword && <span className="text-emerald-600 font-extrabold">(Saved Securely)</span>}
                      </label>
                      <input
                        type="password"
                        placeholder={smtpHasPassword ? "•••••••••••••••• (Unchanged unless edited)" : "Enter SMTP Password"}
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase">Sender Address ("From")</label>
                    <input
                      type="text"
                      required
                      placeholder='e.g. "CombatFlow Taekwondo" <no-reply@combatflow.com>'
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={smtpLoading}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {smtpLoading ? 'Saving Configurations...' : 'Save Configuration & Reload Transporter'}
                  </button>
                </form>
              </div>

              {/* SMTP Tester Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">Verify Mailer Delivery</h3>
                <p className="text-[11px] text-slate-400">Send an instant real test verification email to any inbox of your choice using your saved SMTP configurations to ensure correct delivery and avoid bounce errors.</p>
                
                {smtpTestError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-lg">
                    {smtpTestError}
                  </div>
                )}
                {smtpTestSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold p-3.5 rounded-lg">
                    {smtpTestSuccess}
                  </div>
                )}

                <form onSubmit={handleTestSMTP} className="space-y-3 text-xs font-sans max-w-md">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-700 uppercase">Destination Test Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="test-recipient@domain.com"
                      value={smtpTestEmail}
                      onChange={(e) => setSmtpTestEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={smtpTestLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {smtpTestLoading ? 'Sending Test Delivery...' : 'Trigger Test Email Send'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
