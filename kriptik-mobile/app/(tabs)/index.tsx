/**
 * Projects/Dashboard Screen
 *
 * Shows user's projects and allows starting new builds
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, type Project, type Build } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// Status indicator colors
const statusColors: Record<Build['status'], string> = {
  pending: '#F59E0B',
  planning: '#F59E0B',
  implementing: '#F59E0B',
  verifying: '#14B8A6',
  complete: '#22C55E',
  failed: '#EF4444',
  cancelled: '#6B7280',
};

export default function ProjectsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    const result = await api.getProjects();
    if (result.success && result.data) {
      setProjects(result.data);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    const result = await api.createProject({
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || undefined,
    });

    if (result.success && result.data) {
      setProjects((prev) => [result.data!, ...prev]);
      setShowNewProject(false);
      setNewProjectName('');
      setNewProjectDesc('');
      // Navigate to the new project
      router.push(`/project/${result.data.id}`);
    }
    setIsCreating(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 13,
              color: '#A8A29E',
              fontFamily: 'DM Sans',
            }}
          >
            Welcome back,
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#FFFFFF',
              fontFamily: 'Outfit Bold',
            }}
          >
            {user?.name?.split(' ')[0] || 'Builder'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setShowNewProject(true)}
          style={{
            backgroundColor: '#F59E0B',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: '#0C0A09', fontSize: 18, fontWeight: '600' }}>+</Text>
          <Text
            style={{
              color: '#0C0A09',
              fontSize: 14,
              fontWeight: '600',
              fontFamily: 'DM Sans Bold',
            }}
          >
            New
          </Text>
        </TouchableOpacity>
      </View>

      {/* Projects List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingTop: 0 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#F59E0B"
            />
          }
        >
          {projects.length === 0 ? (
            <View
              style={{
                paddingVertical: 60,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#1C1917',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 28, color: '#57534E' }}>+</Text>
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  marginBottom: 8,
                  fontFamily: 'Outfit Medium',
                }}
              >
                No projects yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#A8A29E',
                  textAlign: 'center',
                  fontFamily: 'DM Sans',
                }}
              >
                Create your first project to start{'\n'}building with AI
              </Text>
            </View>
          ) : (
            projects.map((project) => (
              <TouchableOpacity
                key={project.id}
                onPress={() => router.push(`/project/${project.id}`)}
                style={{
                  backgroundColor: '#1C1917',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#292524',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '600',
                      color: '#FFFFFF',
                      fontFamily: 'Outfit Medium',
                      flex: 1,
                    }}
                  >
                    {project.name}
                  </Text>

                  {project.lastBuildStatus && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        backgroundColor: `${statusColors[project.lastBuildStatus]}15`,
                        borderRadius: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: statusColors[project.lastBuildStatus],
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: statusColors[project.lastBuildStatus],
                          textTransform: 'uppercase',
                        }}
                      >
                        {project.lastBuildStatus}
                      </Text>
                    </View>
                  )}
                </View>

                {project.description && (
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#A8A29E',
                      fontFamily: 'DM Sans',
                      marginBottom: 8,
                    }}
                    numberOfLines={2}
                  >
                    {project.description}
                  </Text>
                )}

                <Text
                  style={{
                    fontSize: 12,
                    color: '#57534E',
                    fontFamily: 'DM Sans',
                  }}
                >
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* New Project Modal */}
      <Modal
        visible={showNewProject}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewProject(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }}>
          <View style={{ flex: 1, padding: 20 }}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 32,
              }}
            >
              <TouchableOpacity onPress={() => setShowNewProject(false)}>
                <Text style={{ color: '#A8A29E', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  fontFamily: 'Outfit Medium',
                }}
              >
                New Project
              </Text>
              <TouchableOpacity
                onPress={handleCreateProject}
                disabled={!newProjectName.trim() || isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Text
                    style={{
                      color: newProjectName.trim() ? '#F59E0B' : '#57534E',
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  color: '#A8A29E',
                  fontSize: 13,
                  marginBottom: 8,
                  fontFamily: 'DM Sans Medium',
                }}
              >
                Project Name
              </Text>
              <TextInput
                value={newProjectName}
                onChangeText={setNewProjectName}
                placeholder="My App"
                placeholderTextColor="#57534E"
                autoFocus
                style={{
                  backgroundColor: '#1C1917',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#292524',
                  fontFamily: 'DM Sans',
                }}
              />
            </View>

            {/* Description Input */}
            <View>
              <Text
                style={{
                  color: '#A8A29E',
                  fontSize: 13,
                  marginBottom: 8,
                  fontFamily: 'DM Sans Medium',
                }}
              >
                Description (optional)
              </Text>
              <TextInput
                value={newProjectDesc}
                onChangeText={setNewProjectDesc}
                placeholder="What are you building?"
                placeholderTextColor="#57534E"
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: '#1C1917',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#292524',
                  fontFamily: 'DM Sans',
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
