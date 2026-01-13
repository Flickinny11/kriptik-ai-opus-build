/**
 * Builds Screen
 *
 * Shows all active and recent builds
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, type Build } from '@/lib/api';

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

const statusLabels: Record<Build['status'], string> = {
  pending: 'Pending',
  planning: 'Planning',
  implementing: 'Building',
  verifying: 'Verifying',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function BuildCard({ build, onPress }: { build: Build; onPress: () => void }) {
  const isActive = ['pending', 'planning', 'implementing', 'verifying'].includes(build.status);
  const statusColor = statusColors[build.status];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: '#1C1917',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isActive ? `${statusColor}40` : '#292524',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#FFFFFF',
              fontFamily: 'Outfit Medium',
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {build.prompt}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: '#57534E',
              fontFamily: 'DM Sans',
            }}
          >
            {new Date(build.startedAt).toLocaleString()}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: `${statusColor}15`,
            borderRadius: 8,
            marginLeft: 12,
          }}
        >
          {isActive && (
            <ActivityIndicator size="small" color={statusColor} style={{ transform: [{ scale: 0.7 }] }} />
          )}
          {!isActive && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: statusColor,
              }}
            />
          )}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: statusColor,
            }}
          >
            {statusLabels[build.status]}
          </Text>
        </View>
      </View>

      {/* Progress bar for active builds */}
      {isActive && (
        <View style={{ marginBottom: 8 }}>
          <View
            style={{
              height: 4,
              backgroundColor: '#292524',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${build.progress}%`,
                backgroundColor: statusColor,
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: 6,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                color: '#A8A29E',
                fontFamily: 'DM Sans',
              }}
            >
              {build.currentPhase || 'Starting...'}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: '#A8A29E',
                fontFamily: 'DM Sans',
              }}
            >
              {build.progress}%
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function BuildsScreen() {
  const router = useRouter();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBuilds = useCallback(async () => {
    const result = await api.getBuilds();
    if (result.success && result.data) {
      // Sort builds: active first, then by date
      const sorted = result.data.sort((a, b) => {
        const aActive = ['pending', 'planning', 'implementing', 'verifying'].includes(a.status);
        const bActive = ['pending', 'planning', 'implementing', 'verifying'].includes(b.status);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
      setBuilds(sorted);
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchBuilds();
    // Poll for updates every 5 seconds when there are active builds
    const interval = setInterval(() => {
      const hasActive = builds.some((b) =>
        ['pending', 'planning', 'implementing', 'verifying'].includes(b.status)
      );
      if (hasActive) {
        fetchBuilds();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchBuilds, builds]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchBuilds();
  }, [fetchBuilds]);

  const activeBuilds = builds.filter((b) =>
    ['pending', 'planning', 'implementing', 'verifying'].includes(b.status)
  );
  const recentBuilds = builds.filter(
    (b) => !['pending', 'planning', 'implementing', 'verifying'].includes(b.status)
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0C0A09' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#FFFFFF',
            fontFamily: 'Outfit Bold',
          }}
        >
          Builds
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: '#A8A29E',
            fontFamily: 'DM Sans',
            marginTop: 4,
          }}
        >
          {activeBuilds.length > 0
            ? `${activeBuilds.length} active build${activeBuilds.length > 1 ? 's' : ''}`
            : 'No active builds'}
        </Text>
      </View>

      {/* Builds List */}
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
          {builds.length === 0 ? (
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
                <View
                  style={{
                    width: 20,
                    height: 4,
                    backgroundColor: '#57534E',
                    borderRadius: 2,
                    marginBottom: 4,
                  }}
                />
                <View
                  style={{
                    width: 14,
                    height: 4,
                    backgroundColor: '#57534E80',
                    borderRadius: 2,
                  }}
                />
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
                No builds yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#A8A29E',
                  textAlign: 'center',
                  fontFamily: 'DM Sans',
                }}
              >
                Start a build from one of your projects
              </Text>
            </View>
          ) : (
            <>
              {/* Active Builds Section */}
              {activeBuilds.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#F59E0B',
                      marginBottom: 12,
                      fontFamily: 'DM Sans Medium',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Active
                  </Text>
                  {activeBuilds.map((build) => (
                    <BuildCard
                      key={build.id}
                      build={build}
                      onPress={() => router.push(`/build/${build.id}`)}
                    />
                  ))}
                </View>
              )}

              {/* Recent Builds Section */}
              {recentBuilds.length > 0 && (
                <View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#A8A29E',
                      marginBottom: 12,
                      fontFamily: 'DM Sans Medium',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Recent
                  </Text>
                  {recentBuilds.map((build) => (
                    <BuildCard
                      key={build.id}
                      build={build}
                      onPress={() => router.push(`/build/${build.id}`)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
