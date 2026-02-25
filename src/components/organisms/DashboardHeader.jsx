import React from 'react';
import { Typography } from '../atoms/Typography';
import { Wallet } from 'lucide-react';

export function DashboardHeader() {
    return (
        <header className="flex items-center justify-between pb-6">
            <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-lg">
                    <Wallet className="h-6 w-6" />
                </div>
                <div>
                    <Typography variant="h3" className="mb-0">Gestão Fácil</Typography>
                    <Typography variant="muted" className="mt-0">Controle financeiro do seu negócio</Typography>
                </div>
            </div>
            <div>
                <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                        GN
                    </div>
                    <Typography variant="p" className="text-sm font-medium hidden sm:block">
                        Administrador
                    </Typography>
                </div>
            </div>
        </header>
    );
}
