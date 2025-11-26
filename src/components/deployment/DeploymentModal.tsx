import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useDeploymentStore } from '../../store/useDeploymentStore';
import DeploymentConfig from './DeploymentConfig';
import DeploymentStatus from './DeploymentStatus';
import DeploymentSuccess from './DeploymentSuccess';

export default function DeploymentModal() {
    const { isOpen, setIsOpen, status } = useDeploymentStore();

    const getTitle = () => {
        switch (status) {
            case 'deploying': return 'Deploying Application';
            case 'success': return 'Deployment Complete';
            case 'error': return 'Deployment Failed';
            default: return 'Deploy Your App';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    {status === 'idle' && <DeploymentConfig />}
                    {(status === 'deploying' || status === 'error') && <DeploymentStatus />}
                    {status === 'success' && <DeploymentSuccess />}
                </div>
            </DialogContent>
        </Dialog>
    );
}
