import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../lib/design-system';
import { useProjectStore } from '../store/project-store';
import { useBuildStore } from '../store/build-store';
import { GlassCard, Button } from '../components/ui';
import { CloseIcon, PlusIcon, RocketIcon, ChevronRightIcon } from '../components/icons';

const FRAMEWORKS = [
  { id: 'nextjs', name: 'Next.js', description: 'React framework for production' },
  { id: 'react', name: 'React', description: 'UI component library' },
  { id: 'vue', name: 'Vue.js', description: 'Progressive JavaScript framework' },
  { id: 'svelte', name: 'Svelte', description: 'Compile-time framework' },
  { id: 'express', name: 'Express', description: 'Node.js web framework' },
  { id: 'fastapi', name: 'FastAPI', description: 'Python web framework' },
];

export default function NewBuildScreen() {
  const [step, setStep] = useState<'select' | 'create'>('select');
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('nextjs');
  const [isCreating, setIsCreating] = useState(false);

  const { projects, fetchProjects, createProject, setCurrentProject } = useProjectStore();
  const { startNewSession } = useBuildStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleSelectProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentProject(project);
      const sessionId = await startNewSession(projectId);
      router.replace(`/build/${sessionId}`);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const project = await createProject({
      name: newProjectName.trim(),
      framework: selectedFramework,
    });

    if (project) {
      const sessionId = await startNewSession(project.id);
      router.replace(`/build/${sessionId}`);
    }

    setIsCreating(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'select' ? 'New Build' : 'Create Project'}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <CloseIcon size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {step === 'select' ? (
            <>
              {/* Create New Project */}
              <Animated.View entering={FadeInDown.delay(100)}>
                <TouchableOpacity
                  style={styles.createCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setStep('create');
                  }}
                >
                  <View style={styles.createIcon}>
                    <PlusIcon size={24} color={colors.accent.primary} />
                  </View>
                  <View style={styles.createInfo}>
                    <Text style={styles.createTitle}>Create New Project</Text>
                    <Text style={styles.createSubtitle}>
                      Start fresh with a new codebase
                    </Text>
                  </View>
                  <ChevronRightIcon size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </Animated.View>

              {/* Existing Projects */}
              {projects.length > 0 && (
                <Animated.View entering={FadeInDown.delay(200)}>
                  <Text style={styles.sectionTitle}>Continue with existing project</Text>
                  {projects.map((project, index) => (
                    <Animated.View
                      key={project.id}
                      entering={FadeInDown.delay(250 + index * 50)}
                    >
                      <GlassCard
                        style={styles.projectCard}
                        onPress={() => handleSelectProject(project.id)}
                      >
                        <View style={styles.projectIcon}>
                          <RocketIcon size={20} color={colors.text.secondary} />
                        </View>
                        <View style={styles.projectInfo}>
                          <Text style={styles.projectName}>{project.name}</Text>
                          <Text style={styles.projectFramework}>{project.framework}</Text>
                        </View>
                        <ChevronRightIcon size={20} color={colors.text.tertiary} />
                      </GlassCard>
                    </Animated.View>
                  ))}
                </Animated.View>
              )}
            </>
          ) : (
            <>
              {/* Project Name */}
              <Animated.View entering={FadeInDown.delay(100)}>
                <Text style={styles.label}>Project Name</Text>
                <TextInput
                  style={styles.input}
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  placeholder="My Awesome App"
                  placeholderTextColor={colors.text.tertiary}
                  autoFocus
                />
              </Animated.View>

              {/* Framework Selection */}
              <Animated.View entering={FadeInDown.delay(200)}>
                <Text style={styles.label}>Framework</Text>
                <View style={styles.frameworkGrid}>
                  {FRAMEWORKS.map((framework, index) => (
                    <Animated.View
                      key={framework.id}
                      entering={FadeInDown.delay(250 + index * 30)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.frameworkCard,
                          selectedFramework === framework.id && styles.frameworkCardSelected,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedFramework(framework.id);
                        }}
                      >
                        <Text
                          style={[
                            styles.frameworkName,
                            selectedFramework === framework.id && styles.frameworkNameSelected,
                          ]}
                        >
                          {framework.name}
                        </Text>
                        <Text style={styles.frameworkDescription}>
                          {framework.description}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>

              {/* Actions */}
              <Animated.View entering={FadeInDown.delay(400)} style={styles.actions}>
                <Button
                  title="Back"
                  variant="secondary"
                  onPress={() => {
                    Haptics.selectionAsync();
                    setStep('select');
                  }}
                  style={styles.backButton}
                />
                <Button
                  title="Create & Build"
                  onPress={handleCreateProject}
                  loading={isCreating}
                  disabled={!newProjectName.trim()}
                  style={styles.createButton}
                />
              </Animated.View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.display,
    color: colors.text.primary,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.accent.muted,
  },
  createIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  createTitle: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  createSubtitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  projectName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  projectFramework: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.primary,
    marginBottom: spacing['2xl'],
  },
  frameworkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  frameworkCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    width: '48%',
  },
  frameworkCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.muted,
  },
  frameworkName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.bodySemiBold,
    color: colors.text.primary,
  },
  frameworkNameSelected: {
    color: colors.accent.primary,
  },
  frameworkDescription: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
  },
  createButton: {
    flex: 2,
  },
});
