import { User as FirebaseUser } from 'firebase/auth';
import { LogIn, Plus, Search, Filter, MapIcon, Edit3 } from 'lucide-react';
import { cn } from '../utils/cn';
import { Category, Collection } from '../types';
import { CATEGORIES } from '../utils/constants';

interface HeaderProps {
  user: FirebaseUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onAddPlace: () => void;
  selectedCollectionId: string | 'all';
  setSelectedCollectionId: (id: string | 'all') => void;
  collections: Collection[];
  setEditingCollection: (collection: Collection) => void;
  setIsNewCollectionModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: 'list' | 'map';
  setActiveTab: (tab: 'list' | 'map') => void;
  selectedCategory: Category | 'All';
  setSelectedCategory: (category: Category | 'All') => void;
}

export function Header({
  user,
  onLogin,
  onLogout,
  onAddPlace,
  selectedCollectionId,
  setSelectedCollectionId,
  collections,
  setEditingCollection,
  setIsNewCollectionModalOpen,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  selectedCategory,
  setSelectedCategory
}: HeaderProps) {
  return (
    <header className="ios-blur sticky top-0 z-20 px-4 pt-12 pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Places</h1>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-1.5">
                <img src={user.photoURL || ''} alt="" className="w-4 h-4 rounded-full" />
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{user.displayName?.split(' ')[0]}</span>
                <button onClick={onLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">Logout</button>
              </div>
            ) : (
              <button onClick={onLogin} className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                <LogIn className="w-3 h-3" />
                Login to Sync
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAddPlace}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Collections Selector */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        <button
          onClick={() => setSelectedCollectionId('all')}
          className={cn(
            "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2",
            selectedCollectionId === 'all'
              ? "bg-slate-900 border-slate-900 text-white shadow-md"
              : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
          )}
        >
          All
        </button>
        {collections.map(coll => (
          <div key={coll.id} className="relative group flex-shrink-0">
            <button
              onClick={() => setSelectedCollectionId(coll.id)}
              onDoubleClick={() => setEditingCollection(coll)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2 flex items-center gap-2",
                selectedCollectionId === coll.id
                  ? "bg-blue-600 border-blue-600 text-white shadow-md"
                  : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
              )}
            >
              {coll.name}
              {selectedCollectionId === coll.id && (
                <Edit3
                  className="w-3 h-3 opacity-60 hover:opacity-100 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCollection(coll);
                  }}
                />
              )}
            </button>
          </div>
        ))}
        <button
          onClick={() => setIsNewCollectionModalOpen(true)}
          className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search your places..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-200/50 rounded-xl mb-4">
        <button
          onClick={() => setActiveTab('list')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
            activeTab === 'list' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
          )}
        >
          <Filter className="w-4 h-4" />
          List
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
            activeTab === 'map' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
          )}
        >
          <MapIcon className="w-4 h-4" />
          Map
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          onClick={() => setSelectedCategory('All')}
          className={cn(
            "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            selectedCategory === 'All'
              ? "bg-slate-900 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => setSelectedCategory(cat.label)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              selectedCategory === cat.label
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>
    </header>
  );
}
