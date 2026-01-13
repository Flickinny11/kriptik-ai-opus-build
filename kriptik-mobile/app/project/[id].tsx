/**
 * Project Detail Screen
 *
 * Shows project details and allows starting new builds
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api, type Project, type Build } from '@/lib/api';

// Status colors
const statusColors: Record<Build['status'], string> = {
  pending: '#F59E0B',
  planning: '#F59E0B',
  implementing: '#F59E0B',
  verifying: '#14B8A6',
  complete: '#22C55E',
  failed: '#EF4444',
  cancelled: '#6B7280',
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isStartingBuild, setIsStartingBuild] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!id) return;

    const [projectResult, buildsResult] = await Promise.all([
      api.getProject(id),
      api.getBuilds(id),
    ]);

    if (projectResult.success && projectResult.data) {
      setProject(projectResult.data);
    }

    if (buildsResult.success && buildsResult.data) {
      setBuilds(buildsResult.data);
    }

    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleStartBuild = async () => {
    if (!prompt.trim() || !id) return;

    setIsStartingBuild(true);
    const result = await api.startBuild(id, prompt.trim());

    if (result.success && result.data) {
      setPrompt('');
      router.push(`/build/${result.data.id}`);
    }

    setIsStartingBuild(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18 }}>Project not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: '#F59E0B', fontSize: 16 }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#0C0A09' },
          headerTintColor: '#FFFFFF',
          headerTitle: project.name,
          headerBackTitle: 'Back',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Project Info */}
          <View
            style={{
              backgroundColor: '#1C1917',
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: '#292524',
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: '600',
                color: '#FFFFFF',
                fontFamily: 'Outfit Medium',
                marginBottom: 8,
              }}
            >
              {project.name}
            </Text>

            {project.description && (
              <Text
                style={{
                  fontSize: 14,
                  color: '#A8A29E',
                  fontFamily: 'DM Sans',
                  marginBottom: 12,
                  lineHeight: 20,
                }}
              >
                {project.description}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Text style={{ fontSize: 12, color: '#57534E', fontFamily: 'DM Sans' }}>
                Created {new Date(project.createdAt).toLocaleDateString()}
              </Text>
              <Text style={{ fontSize: 12, color: '#57534E', fontFamily: 'DM Sans' }}>
                {builds.length} build{builds.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* New Build Input */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 12,
                fontFamily: 'Outfit Medium',
              }}
            >
              Start a new build
            </Text>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="What do you want to build?"
              placeholderTextColor="#57534E"
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: '#1C1917',
                borderRadius: 12,
                padding: 16,
                fontSize: 15,
                color: '#FFFFFF',
                borderWidth: 1,
                borderColor: prompt ? '#F59E0B40' : '#292524',
                fontFamily: 'DM Sans',
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
            <TouchableOpacity
              onPress={handleStartBuild}
              disabled={!prompt.trim() || isStartingBuild}
              style={{
                backgroundColor: prompt.trim() ? '#F59E0B' : '#292524',
                borderRadius: 12,
                padding: 14,
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              {isStartingBuild ? (
                <ActivityIndicator size="small" color="#0C0A09" />
              ) : (
                <Text
                  style={{
                    color: prompt.trim() ? '#0C0A09' : '#57534E',
                    fontSize: 15,
                    fontWeight: '600',
                    fontFamily: 'DM Sans Bold',
                  }}
                >
                  Start Building
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Build History */}
          {builds.length > 0 && (
            <View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  marginBottom: 12,
                  fontFamily: 'Outfit Medium',
                }}
              >
                Build History
              </Text>

              {builds.map((build) => {
                const isActive = ['pending', 'planning', 'implementing', 'verifying'].includes(
                  build.status
                );
                const statusColor = statusColors[build.status];

                return (
                  <TouchableOpacity
                    key={build.id}
                    onPress={() => router.push(`/build/${build.id}`)}
                    style={{
                      backgroundColor: '#1C1917',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      borderWidth: 1,
                      borderColor: isActive ? `${statusColor}40` : '#292524',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#FFFFFF',
                          fontFamily: 'DM Sans',
                          flex: 1,
                        }}
                        numberOfLines={2}
                      >
                        {build.prompt}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          backgroundColor: `${statusColor}15`,
                          borderRadius: 6,
                          marginLeft: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: statusColor,
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '600',
                            color: statusColor,
                            textTransform: 'uppercase',
                          }}
                        >
                          {build.status}
                        </Text>
                      </View>
                    </View>

                    {isActive && (
                      <View style={{ marginTop: 10 }}>
                        <View
                          style={{
                            height: 3,
                            backgroundColor: '#292524',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              height: '100%',
                              width: `${build.progress}%`,
                              backgroundColor: statusColor,
                            }}
                          />
                        </View>
                      </View>
                    )}

                    <Text
                      style={{
                        fontSize: 11,
                        color: '#57534E',
                        fontFamily: 'DM Sans',
                        marginTop: 8,
                      }}
                    >
                      {new Date(build.startedAt).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
