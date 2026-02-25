import React from 'react';
import { cn } from '../../lib/utils';
import { User, FileText, GraduationCap, Award, FileSymlink, ChevronLeft } from 'lucide-react';
import { Avatar } from '../atoms/Avatar';

const MENU_ITEMS = [
    { id: 'alunos', label: 'Alunos', icon: User, active: true },
    { id: 'pendencias', label: 'Pendências', icon: FileText, active: false },
    { id: 'colacao', label: 'Colação de grau', icon: GraduationCap, active: false },
    { id: 'diplomas', label: 'Diplomas', icon: Award, active: false },
    { id: 'publicacao', label: 'Publicação no Dou', icon: FileSymlink, active: false },
];

export function Sidebar() {
    return (
        <aside className="w-[280px] h-screen bg-white border-r border-gray-100 flex flex-col shrink-0">
            {/* Logo */}
            <div className="h-24 flex items-center px-8">
                <span className="text-3xl font-bold tracking-tight text-[#7E1A8B]">
                    ănıma
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto">
                {MENU_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all group",
                                item.active
                                    ? "bg-[#F3E8F6] text-[#7E1A8B]"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-5 w-5",
                                    item.active
                                        ? "text-[#7E1A8B]"
                                        : "text-gray-400 group-hover:text-gray-600"
                                )}
                            />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* Footer with avatar and collapse */}
            <div className="p-6 mt-auto">
                <div className="flex items-center justify-between">
                    <Avatar name="Nal Admin" size="md" className="ring-2 ring-white shadow-sm" />
                    <button className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
