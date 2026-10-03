import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { FileDown, Calendar, AlertTriangle, CheckCircle, Trophy, Sparkles, Building, PhoneCall, ChevronRight, LogIn, Clock } from 'lucide-react';
import { CATEGORY_STRUCTURE, calculateAgeOnEvent, determineAgeCategory, getAgeCategory } from '../utils/categories';

export const Register: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  // Redirect if not authenticated
  useEffect(() => {
    trackEngagement('page_view_register', `/events/${eventId || 'default'}/register`, user?._id);
    if (!user) {
      navigate('/signin');
    }
  }, [user, navigate, eventId]);

  // Load existing registration if already registered as a competitor
  useEffect(() => {
    const checkExistingRegistration = async () => {
      if (!user) return;
      try {
        const res = await fetch('/api/registrations', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            // If registering for specific event, verify if already registered for that event
            const match = eventId 
              ? data.find((r: any) => r.eventId === eventId)
              : data[0];
            
            if (match) {
              setRegisteredCopy(match);
            }
          }
        }
      } catch (err) {
        console.error('Error checking registration status:', err);
      }
    };
    checkExistingRegistration();
  }, [user, eventId]);

  // Form states
  const [event, setEvent] = useState<any | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [weightCategory, setWeightCategory] = useState('');
  const [beltRank, setBeltRank] = useState('white');
  const [coachName, setCoachName] = useState('');
  const [aadharLastFour, setAadharLastFour] = useState('');
  const [rawAadhar, setRawAadhar] = useState('');
  const [aadharFocused, setAadharFocused] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [photoError, setPhotoError] = useState<string | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredCopy, setRegisteredCopy] = useState<any | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'warning') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Verification checkbox state
  const [isVerified, setIsVerified] = useState(false);

  // Computed Age & Age Category states
  const [computedAge, setComputedAge] = useState<number | null>(null);
  const [computedAgeCategory, setComputedAgeCategory] = useState<string | null>(null);
  const [overlapPreference, setOverlapPreference] = useState<'Junior' | 'Senior'>('Junior');
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Coach states for event scoping
  const [coachesList, setCoachesList] = useState<any[]>([]);
  const [inlineCoachName, setInlineCoachName] = useState('');
  const [showInlineCoachInput, setShowInlineCoachInput] = useState(false);

  // Load coaches
  useEffect(() => {
    const loadCoaches = async () => {
      try {
        const res = await fetch('/api/coaches');
        if (res.ok) {
          setCoachesList(await res.json());
        }
      } catch (err) {
        console.error('Failed to load coaches:', err);
      }
    };
    loadCoaches();
  }, []);

  // Load dynamic categories for target event
  useEffect(() => {
    const loadCategories = async () => {
      const targetId = eventId || 'evt_autumn2026';
      try {
        const res = await fetch(`/api/categories?eventId=${targetId}`);
        if (res.ok) {
          const list = await res.json();
          setDbCategories(list);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, [eventId]);

  // Fetch current event to check registration deadline
  useEffect(() => {
    const fetchEvent = async () => {
      const targetId = eventId || 'evt_autumn2026';
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const list = await res.json();
          const match = list.find((e: any) => e._id === targetId);
          setEvent(match || null);
        }
      } catch (err) {
        console.error('Failed to load event details:', err);
      } finally {
        setLoadingEvent(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  const isDeadlinePassed = useMemo(() => {
    if (!event || !event.registrationDeadline) return false;
    return new Date() > new Date(event.registrationDeadline);
  }, [event]);

  const allowedCoaches = useMemo(() => {
    if (!event) return coachesList;
    const allowed = event.allowedCoachIds || [];
    if (allowed.length === 0) {
      // Backward compatibility: If no allowedCoachIds are configured, display all global coaches
      return coachesList;
    }
    return coachesList.filter((c: any) => allowed.includes(c._id));
  }, [event, coachesList]);

  // Compute age and ageCategory reactively when dob is changed
  useEffect(() => {
    if (!dob) {
      setComputedAge(null);
      setComputedAgeCategory(null);
      return;
    }
    const age = calculateAgeOnEvent(dob);
    setComputedAge(age);

    if (dbCategories.length > 0) {
      // 2009 Born Overlap Preference
      const birthYear = new Date(dob).getFullYear();
      if (birthYear === 2009) {
        const found = dbCategories.find(c => c._id === overlapPreference);
        if (found) {
          setComputedAgeCategory(found._id);
          return;
        }
      }

      // Find standard category match by age bounds
      const match = dbCategories.find(c => age >= c.minAge && age <= c.maxAge);
      if (match) {
        setComputedAgeCategory(match._id);
      } else {
        setComputedAgeCategory(null);
      }
    } else {
      // Fallback
      const cat = getAgeCategory(dob, overlapPreference);
      setComputedAgeCategory(cat);
    }
  }, [dob, overlapPreference, dbCategories]);

  // Retrieve matching weight division choices for current age category + gender
  const availableWeightClasses = useMemo(() => {
    if (!computedAgeCategory) return [];
    if (dbCategories.length > 0) {
      const match = dbCategories.find(c => c._id === computedAgeCategory);
      if (match) {
        return gender === 'male' ? match.maleWeightClasses : match.femaleWeightClasses;
      }
    }
    // Static fallback
    const classesObj = CATEGORY_STRUCTURE[computedAgeCategory]?.[gender];
    return classesObj ? Object.keys(classesObj) : [];
  }, [computedAgeCategory, gender, dbCategories]);

  // Handle setting default weightCategory when available choices change
  useEffect(() => {
    if (availableWeightClasses.length > 0) {
      if (!availableWeightClasses.includes(weightCategory)) {
        setWeightCategory(availableWeightClasses[0]);
      }
    } else {
      setWeightCategory('');
    }
  }, [availableWeightClasses, weightCategory]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize largest dimension to max 500px
        const MAX_SIZE = 500;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with quality 0.8
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setPhotoBase64(compressedDataUrl);
          showToast('Photo uploaded, resized and compressed successfully!', 'success');
        } else {
          setPhotoError('Could not process canvas context.');
        }
      };
      img.onerror = () => {
        setPhotoError('Invalid image file.');
      };
    };
    reader.onerror = () => {
      setPhotoError('Failed to read photo.');
    };
    reader.readAsDataURL(file);
  };

  const handleAadharChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 12);
    setRawAadhar(limited);
    
    if (limited.length >= 4) {
      setAadharLastFour(limited.slice(-4));
    } else {
      setAadharLastFour(limited);
    }
  };

  const getAadharDisplayValue = () => {
    if (aadharFocused) {
      return rawAadhar.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    } else {
      let masked = '';
      for (let i = 0; i < rawAadhar.length; i++) {
        if (i === 4 || i === 8) {
          masked += ' ';
        }
        if (i < 8) {
          masked += 'x';
        } else {
          masked += rawAadhar[i];
        }
      }
      return masked;
    }
  };

  const handleDownloadPdf = (regId: string, fullName: string) => {
    trackEngagement('pdf_download_clicked', '/register', user?._id);
    const link = document.createElement('a');
    link.href = `/api/registrations/download/${regId}`;
    link.download = `CombatFlow_Registration_${regId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      const errMsg = 'You must be logged in to register.';
      setError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    if (!isVerified) {
      const errMsg = 'Please check and confirm the verification box before submitting.';
      setError(errMsg);
      showToast(errMsg, 'warning');
      return;
    }

    if (rawAadhar.length !== 12) {
      const errMsg = 'Aadhar must be exactly 12 numeric digits.';
      setError(errMsg);
      showToast(errMsg, 'warning');
      return;
    }

    if (!photoBase64) {
      const errMsg = 'Please upload your competitor profile photo (Max 100 KB).';
      setError(errMsg);
      showToast(errMsg, 'warning');
      return;
    }

    setError(null);
    // Show summary modal to review details before submission
    setShowSummaryModal(true);
  };

  const executeRegistrationSubmit = async () => {
    setShowSummaryModal(false);
    setLoading(true);
    setError(null);

    try {
      // Convert the compressed base64 dataURI to a raw binary Blob
      const base64Response = await fetch(photoBase64);
      const photoBlob = await base64Response.blob();

      // Construct multipart form data
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('dob', dob);
      formData.append('gender', gender);
      formData.append('weightCategory', weightCategory);
      formData.append('beltRank', beltRank);
      formData.append('coachName', coachName);
      formData.append('aadharLastFour', aadharLastFour);
      formData.append('photo', photoBlob, 'competitor_photo.jpg');

      const postUrl = eventId 
        ? `/api/events/${eventId}/register`
        : '/api/registrations';

      const res = await fetch(postUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit registration');
      }

      setRegisteredCopy(data.registration);
      trackEngagement('competitor_registered_success', '/register', user?._id);
    } catch (err: any) {
      setError(err.message || 'Server error occurred during competitor registration.');
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (url: string) => {
    trackEngagement('pdf_download_clicked', '/register', user?._id);
    window.location.href = url; // Fail-safe direct iFrame asset download
  };

  if (!user) {
    return (
      <div className="min-h-[80vh] bg-slate-50 flex flex-col justify-center items-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-200 text-amber-600 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Athlete Login Required</h2>
        <p className="text-sm text-slate-500 max-w-sm mt-1 leading-relaxed">
          Please log in or create a player profile before submitting your formal competitor registration sheet.
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-lg transition-all cursor-pointer shadow"
        >
          <LogIn className="w-4 h-4" />
          <span>Access Account Portal</span>
        </button>
      </div>
    );
  }

  // If already registered successfully, show beautiful Certificate PDF download view
  if (registeredCopy) {
    return (
      <div className="min-h-[85vh] bg-slate-50 py-16 px-6">
        <div className="max-w-2xl mx-auto bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden">
          
          {/* Header Graphic */}
          <div className="bg-slate-900 text-white p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative z-10 space-y-2">
              <div className="w-12 h-12 bg-red-600 rounded-full mx-auto flex items-center justify-center text-white shadow-md">
                <CheckCircle className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-red-400 tracking-widest font-mono uppercase">Athlete Confirmed</p>
              <h2 className="text-2xl font-black">Registration Successful!</h2>
            </div>
          </div>

          <div className="p-8 space-y-6">
            
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <Trophy className="w-5 h-5 text-red-600 shrink-0" />
                <h3 className="text-xs font-bold tracking-wide text-slate-800 uppercase">Official Competitor Receipt</h3>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-mono">
                <div className="col-span-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-[10px] font-sans font-black uppercase tracking-wider">Registration ID</span>
                  <span className="font-black text-xs text-red-600 tracking-wide select-all">{registeredCopy._id}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] font-sans font-bold uppercase">Competitor Name</span>
                  <span className="font-bold text-slate-800">{registeredCopy.fullName}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] font-sans font-bold uppercase">Weight Division</span>
                  <span className="font-bold text-red-600">{registeredCopy.weightCategory}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] font-sans font-bold uppercase">Belt Grade</span>
                  <span className="font-bold text-slate-800">{registeredCopy.beltRank}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] font-sans font-bold uppercase">Coach Name</span>
                  <span className="font-bold text-slate-800">{registeredCopy.coachName || registeredCopy.clubName || 'Not Available'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">What to do next?</h4>
              <ul className="text-xs text-slate-500 space-y-2.5">
                <li className="flex gap-2">
                  <span className="w-4 h-4 bg-red-50 text-red-600 font-bold rounded-full flex items-center justify-center shrink-0">1</span>
                  <span><strong>Download your registration receipt:</strong> Save a copy of the generated PDF below. It is mandatory to present a printed or digital copy during official weigh-ins.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-4 h-4 bg-red-50 text-red-600 font-bold rounded-full flex items-center justify-center shrink-0">2</span>
                  <span><strong>Official Weigh-In:</strong> Report to Assembly Hall 4 on October 13, 2026, to verify your body mass index matches your weight division.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-4 h-4 bg-red-50 text-red-600 font-bold rounded-full flex items-center justify-center shrink-0">3</span>
                  <span><strong>Bracket Draw:</strong> Check the public "Live Scores" tab on October 14 to review your opponent, match number, and ring allocations.</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => handleDownloadPdf(registeredCopy._id, registeredCopy.fullName)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-400 active:scale-98 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer text-center"
              >
                <FileDown className="w-4 h-4 animate-bounce" style={{ animationDuration: downloadingPdf ? '1s' : '0s' }} />
                <span>{downloadingPdf ? 'Downloading PDF Slip...' : 'Download PDF Registration Receipt'}</span>
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-98 rounded-xl transition-all cursor-pointer"
              >
                <span>Return to Home Page</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto grid md:grid-cols-12 gap-8">
        
        {/* Info panel */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-bold tracking-wider font-mono uppercase">Event Highlights</span>
            </div>
            <h3 className="text-lg font-black tracking-tight">Autumn Nationals Entry Form</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Submit your registration sheet to enter the tournament pool. The draw pairings bracket is automatically generated upon administrator approval.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex gap-2.5 items-start">
                <Calendar className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-200">Fight Dates</p>
                  <p className="text-slate-400">October 14-16, 2026</p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start">
                <Building className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-200">Official Club Registration</p>
                  <p className="text-slate-400">Entries must belong to an affiliated WT dojang.</p>
                </div>
              </div>

              {event && event.registrationDeadline && (
                <div className="flex gap-2.5 items-start border-t border-slate-800 pt-3">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-200">Registration Deadline</p>
                    <p className="text-slate-400">
                      {new Date(event.registrationDeadline).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-red-50/50 rounded-2xl border border-red-100 p-5 space-y-2.5 text-xs text-red-700">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Weigh-In Requirement</span>
            </div>
            <p className="leading-relaxed">
              Incorrect weight configurations will disqualify competitors. Please verify your current division with your head coach before submitting this form.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="md:col-span-7 bg-white rounded-2xl p-6 shadow-md border border-slate-100">
          
          <div className="border-b border-slate-100 pb-4 mb-5">
            <h2 className="text-xl font-bold text-slate-900">Competitor Details</h2>
            <p className="text-xs text-slate-400 mt-0.5">Please provide accurate identification details.</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3 rounded-lg">
              {error}
            </div>
          )}

          {isDeadlinePassed ? (
            <div className="p-8 text-center bg-rose-50/50 rounded-2xl border border-rose-100 space-y-4 my-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Registration Closed</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  The official registration window for this tournament has officially closed as of {event?.registrationDeadline ? new Date(event.registrationDeadline).toLocaleString() : ''}. 
                  Submissions are no longer accepted for this event.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <span>Back to Events Catalog</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleRegisterSubmit}>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Full Competitor Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Connor McGregor"
                  className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                />
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            {/* Dynamic Age and Age Category Display */}
            {dob && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all duration-300 ${
                computedAgeCategory 
                  ? 'bg-slate-50 border-slate-200' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-700">Computed Age at Event Date</p>
                    <p className="text-slate-500">Event Date: October 15, 2026</p>
                  </div>
                </div>
                <div className="text-right">
                  {computedAgeCategory ? (
                    <>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 text-white font-mono uppercase">
                        {computedAgeCategory} Division
                      </span>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Age: {computedAge} years old
                      </p>
                    </>
                  ) : (
                    <span className="font-bold text-red-600">
                      Age {computedAge}: Out of range (8-32 years)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 2009 Birth Year Overlap Selector */}
            {dob && new Date(dob).getFullYear() === 2009 && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/50 text-xs">
                <div className="flex items-start gap-2.5">
                  <Trophy className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-bold text-amber-900">2009 Birth Year Category Overlap</h4>
                    <p className="text-amber-700/80 mt-0.5 leading-relaxed">
                      Athletes born in 2009 are turning 17 in 2026. According to official Taekwondo regulations, you qualify for both the <strong>Junior</strong> (U18) and <strong>Senior</strong> divisions. Please select your preferred competition category:
                    </p>
                    <div className="flex gap-4 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                        <input
                          type="radio"
                          name="overlapDivision"
                          checked={overlapPreference === 'Junior'}
                          onChange={() => setOverlapPreference('Junior')}
                          className="h-4 w-4 text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
                        />
                        Junior Category (U18)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                        <input
                          type="radio"
                          name="overlapDivision"
                          checked={overlapPreference === 'Senior'}
                          onChange={() => setOverlapPreference('Senior')}
                          className="h-4 w-4 text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
                        />
                        Senior Category
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Weight Division Category
              </label>
              <select
                value={weightCategory}
                onChange={(e) => setWeightCategory(e.target.value)}
                disabled={!computedAgeCategory}
                className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50 disabled:opacity-50"
              >
                {!computedAgeCategory ? (
                  <option value="">Awaiting valid Date of Birth above...</option>
                ) : (
                  availableWeightClasses.map((cat: string, idx: number) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Belt Grade
              </label>
              <select
                value={beltRank}
                onChange={(e) => setBeltRank(e.target.value)}
                className="block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
              >
                <option value="white">white</option>
                <option value="yellow">yellow</option>
                <option value="yellow stripe">yellow stripe</option>
                <option value="green">green</option>
                <option value="green stripe">green stripe</option>
                <option value="blue">blue</option>
                <option value="blue stripe">blue stripe</option>
                <option value="red">red</option>
                <option value="red stripe">red stripe</option>
                <option value="black">black</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Coach Name
              </label>
              {!showInlineCoachInput ? (
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    required
                    value={coachName}
                    onChange={(e) => {
                      if (e.target.value === 'add_new_coach_inline') {
                        setShowInlineCoachInput(true);
                        setCoachName('');
                      } else {
                        setCoachName(e.target.value);
                      }
                    }}
                    className="block w-full pl-10 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50 cursor-pointer appearance-none text-slate-800"
                  >
                    <option value="" disabled>-- Select Coach --</option>
                    {allowedCoaches.map((c: any) => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="add_new_coach_inline">➕ Add New Coach...</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 text-xs">▼</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-slate-100 rounded-lg border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Register Coach for Event</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new coach name..."
                      value={inlineCoachName}
                      onChange={(e) => setInlineCoachName(e.target.value)}
                      className="flex-grow px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!inlineCoachName.trim()) return;
                        const normName = inlineCoachName.trim();

                        const dup = coachesList.find(c => c.name.toLowerCase() === normName.toLowerCase());
                        if (dup) {
                          try {
                            const res = await fetch('/api/coaches', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ name: normName, eventId: event?._id })
                            });
                            if (res.ok) {
                              const syncedCoach = await res.json();
                              setCoachesList(prev => {
                                if (prev.some(c => c._id === syncedCoach._id)) return prev;
                                return [...prev, syncedCoach];
                              });
                              setEvent(prev => prev ? {
                                ...prev,
                                allowedCoachIds: prev.allowedCoachIds ? (prev.allowedCoachIds.includes(syncedCoach._id) ? prev.allowedCoachIds : [...prev.allowedCoachIds, syncedCoach._id]) : [syncedCoach._id]
                              } : prev);
                              setCoachName(syncedCoach.name);
                              setShowInlineCoachInput(false);
                              setInlineCoachName('');
                            }
                          } catch (err) {
                            console.error(err);
                          }
                          return;
                        }

                        try {
                          const res = await fetch('/api/coaches', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ name: normName, eventId: event?._id })
                          });
                          if (res.ok) {
                            const newCoach = await res.json();
                            setCoachesList(prev => [...prev, newCoach]);
                            setEvent(prev => prev ? {
                              ...prev,
                              allowedCoachIds: prev.allowedCoachIds ? [...prev.allowedCoachIds, newCoach._id] : [newCoach._id]
                            } : prev);
                            setCoachName(newCoach.name);
                            setShowInlineCoachInput(false);
                            setInlineCoachName('');
                          } else {
                            const data = await res.json();
                            alert(data.error || 'Failed to add coach');
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-rose-700 shrink-0"
                    >
                      Save & Select
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineCoachInput(false);
                        setInlineCoachName('');
                      }}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Aadhar Number (12 Digits)
              </label>
              <div className="relative rounded-md shadow-sm">
                <input
                  type="text"
                  required
                  placeholder="xxxx xxxx xxxx"
                  value={getAadharDisplayValue()}
                  onChange={handleAadharChange}
                  onFocus={() => setAadharFocused(true)}
                  onBlur={() => setAadharFocused(false)}
                  className="block w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50 font-mono tracking-widest"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Type your full 12-digit Aadhar. The first 8 characters will automatically be masked as 'xxxx xxxx' for privacy.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Upload Profile Photo (Max 100 KB)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="space-y-1.5 text-center">
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-semibold text-red-600 hover:text-red-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-red-500">
                      <span>Upload official photo</span>
                      <input 
                        type="file" 
                        required
                        accept="image/png, image/jpeg" 
                        onChange={handlePhotoUpload} 
                        className="sr-only" 
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">PNG or JPEG format up to 100 KB</p>
                  
                  {photoBase64 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <img 
                        src={photoBase64} 
                        alt="Competitor Preview" 
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-sm"
                      />
                      <span className="text-xs font-bold text-emerald-600">✓ Uploaded Successfully</span>
                    </div>
                  )}

                  {photoError && (
                    <p className="text-xs font-bold text-red-600 mt-2">{photoError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Verification Checkbox */}
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/50 mt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="mt-1 h-4 w-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <div className="text-xs text-slate-700 leading-tight">
                  <p className="font-bold text-slate-800 mb-0.5">Check and Verify Entered Details</p>
                  <p className="text-slate-500 font-medium">
                    I hereby check and verify that all entered details (Name, DOB, Gender, Weight, Belt, Coach Name, Aadhar digits, and uploaded photo) are 100% correct, verified, and match my official identification documents.
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !computedAgeCategory || !isVerified}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:scale-98 rounded-xl transition-all cursor-pointer shadow disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting & Generating PDF...' : 'Submit Entry & Download Receipt Copy'}
              </button>
            </div>

          </form>
          )}

        </div>

      </div>

      {/* Competitor Review Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setShowSummaryModal(false)}
            ></div>

            {/* Trick browser to center modal content */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full border border-slate-100">
              <div className="absolute top-4 right-4">
                <button 
                  onClick={() => setShowSummaryModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white px-6 pt-6 pb-4 sm:p-8 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-red-600" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900" id="modal-title">
                        Review Registration Details
                      </h3>
                    </div>

                    <p className="text-xs text-slate-500 mb-6">
                      Please carefully review all the captured competitor fields below. Once you click <strong>"Confirm & Complete"</strong>, your submission will be finalized and your PDF certificate receipt will be generated.
                    </p>

                    <div className="space-y-6">
                      {/* Photo + Identity Summary Header */}
                      <div className="flex gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                        {photoBase64 ? (
                          <img 
                            src={photoBase64} 
                            alt="Competitor Preview" 
                            className="w-16 h-20 object-cover rounded-lg border border-slate-200 shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-20 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-slate-400 uppercase font-bold text-center px-1">No Photo</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Competitor</p>
                          <h4 className="text-sm font-extrabold text-slate-900 truncate">{fullName || 'Not Provided'}</h4>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <span className="font-semibold text-red-600">{computedAgeCategory || 'Unknown'} Division</span>
                            <span>•</span>
                            <span>{computedAge !== null ? `${computedAge} Years Old` : 'Age N/A'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Detail fields using clean typography layout */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-extrabold mb-0.5 tracking-wider">Date of Birth</span>
                          <span className="font-semibold text-slate-800">{dob}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-extrabold mb-0.5 tracking-wider">Gender</span>
                          <span className="font-semibold text-slate-800 capitalize">{gender}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-extrabold mb-0.5 tracking-wider">Weight Class</span>
                          <span className="font-semibold text-slate-800">{weightCategory || 'Not selected'}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-extrabold mb-0.5 tracking-wider">Belt Grade</span>
                          <span className="font-semibold text-slate-800">{beltRank}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-extrabold mb-0.5 tracking-wider">Coach Name</span>
                          <span className="font-semibold text-slate-800">{coachName || 'None'}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-extrabold mb-0.5 tracking-wider">Aadhar Number</span>
                          <span className="font-mono font-bold text-slate-800 tracking-wider">xxxx xxxx {aadharLastFour}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 sm:px-8 sm:py-5 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 active:scale-98 rounded-lg border border-slate-200 transition-all cursor-pointer"
                >
                  Go Back & Edit
                </button>
                <button
                  type="button"
                  onClick={executeRegistrationSubmit}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-lg transition-all cursor-pointer shadow-md shadow-red-600/10"
                >
                  Confirm & Complete Registration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert System Overlay */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 transform transition-all duration-300 animate-bounce">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border text-xs font-bold ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : toast.type === 'error' 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                toast.type === 'success' 
                  ? 'bg-emerald-400' 
                  : toast.type === 'error' 
                    ? 'bg-red-400' 
                    : 'bg-amber-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                toast.type === 'success' 
                  ? 'bg-emerald-500' 
                  : toast.type === 'error' 
                    ? 'bg-red-500' 
                    : 'bg-amber-500'
              }`}></span>
            </span>
            <p className="flex-1 font-semibold">{toast.message}</p>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2 text-[10px]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
