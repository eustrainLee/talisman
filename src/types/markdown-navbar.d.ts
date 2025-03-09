declare module 'markdown-navbar' {
    interface MarkNavProps {
        className?: string;
        source: string;
        ordered?: boolean;
        headingTopOffset?: number;
    }
    
    const MarkNav: React.FC<MarkNavProps>;
    export default MarkNav;
} 