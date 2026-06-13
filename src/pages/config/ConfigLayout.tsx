import { Outlet } from 'react-router-dom';

export function ConfigLayout() {
    return (
        <div className="flex-1 h-full overflow-hidden flex flex-col p-1 lg:p-2">
            <Outlet />
        </div>
    );
}

